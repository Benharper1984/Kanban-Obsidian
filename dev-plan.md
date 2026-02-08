# Kanban 4000 - Development Guide

Detailed implementation instructions for planned improvements, with specific references to existing code and potential pitfalls.

---

## Table of Contents

1. [Fix Modal Width](#1-fix-modal-width)
2. [Improve Create Note Modal](#2-improve-create-note-modal)
3. [Add Bookmark Toggle to Modals](#3-add-bookmark-toggle-to-modals)
4. [Drag External Files Into Lists](#4-drag-external-files-into-lists)
5. [Toolbar/Breadcrumb UI Reorganization](#5-toolbarbreadcrumb-ui-reorganization)
6. [Save Filter Feature](#6-save-filter-feature)
7. [Undo System](#7-undo-system)
8. [Keyboard Navigation](#8-keyboard-navigation)
9. [Mobile Friendly](#9-mobile-friendly)
10. [Double-Click List Header to Rename](#10-double-click-list-header-to-rename)
11. [Card Count in Breadcrumbs](#11-card-count-in-breadcrumbs)
12. [Open in File Explorer Context Menu](#12-open-in-file-explorer-context-menu)

---

## 1. Fix Modal Width

### Problem
The `MarkdownEditorModal` is too narrow, forcing users to scroll horizontally to see Preview/Edit buttons.

### Files to Modify
- `src/components/MarkdownEditorModal.ts`
- `styles/modals.css`

### Implementation

**In `MarkdownEditorModal.ts`:**

Look for where the modal is created. Obsidian modals have a `modalEl` property you can style:

```typescript
onOpen() {
    const { contentEl, modalEl } = this;
    
    // Add custom class for wider modal
    modalEl.addClass('kanban-markdown-modal-wide');
    
    // ... rest of existing code
}
```

**In `styles/modals.css`:**

```css
/* Wide markdown editor modal */
.kanban-markdown-modal-wide {
    width: 90vw;
    max-width: 900px;
}

.kanban-markdown-modal-wide .modal-content {
    max-height: 80vh;
    overflow-y: auto;
}

/* Ensure action buttons are always visible */
.kanban-editor-actions {
    position: sticky;
    top: 0;
    background: var(--background-primary);
    z-index: 10;
    padding-bottom: var(--kanban-spacing-md);
    border-bottom: 1px solid var(--background-modifier-border);
}
```

### Watch Out For
- **Obsidian's modal system** applies its own max-width. You may need `!important` or higher specificity.
- **Mobile screens** - ensure the 90vw doesn't break on small screens. Add a media query fallback.
- **The `ImagePreviewModal`** might have similar issues - check it too.

### Testing
- Open markdown files of varying lengths
- Test with very long first lines (no word wrap issues?)
- Test on narrow Obsidian windows
- Verify buttons are visible without scrolling

---

## 2. Improve Create Note Modal

### Goal
Add a "Create as Kanban" toggle that pre-populates the new note with kanban template syntax.

### Files to Modify
- `src/components/CreateItemModal.ts`
- `styles/modals.css`

### Current Code Analysis

Looking at `CreateItemModal.ts`, the modal currently just asks for a name and creates a blank file via `createNewFile()`.

### Implementation

**In `CreateItemModal.ts`:**

```typescript
class CreateItemModal extends Modal {
    private name: string = '';
    private createAsKanban: boolean = false;  // ADD THIS
    private itemType: 'file' | 'folder';
    private folder: TFolder;
    private onSubmit: (name: string, asKanban?: boolean) => void;  // MODIFY signature

    // In onOpen(), add toggle after the name input:
    
    if (this.itemType === 'file') {
        const toggleContainer = contentEl.createEl('div', { 
            cls: 'kanban-create-toggle-container' 
        });
        
        const toggle = new ToggleSetting(toggleContainer)
            .setName('Create as Kanban board')
            .setDesc('Pre-populate with kanban template')
            .setValue(this.createAsKanban)
            .onChange((value) => {
                this.createAsKanban = value;
            });
    }
    
    // In submit(), pass the flag:
    private submit() {
        this.onSubmit(this.name, this.createAsKanban);
        this.close();
    }
}
```

**Modify `createNewFile` function:**

```typescript
export async function createNewFile(
    app: App, 
    folder: TFolder, 
    name: string,
    asKanban: boolean = false
): Promise<TFile | null> {
    const filePath = `${folder.path}/${name}.md`;
    
    let content = '';
    if (asKanban) {
        content = `## To Do

- [ ] 

## In Progress

- [ ] 

## Done

- [x] 
`;
    }
    
    try {
        const file = await app.vault.create(filePath, content);
        return file;
    } catch (e) {
        new Notice(`Failed to create file: ${e}`);
        return null;
    }
}
```

**Update callers in `CardActionHandler.ts`:**

The `ModalHandler.showCreateFileModal()` and `showCreateFileModalInFolder()` need to pass through the `asKanban` parameter.

### Watch Out For
- **Import `ToggleComponent`** from 'obsidian' (not `ToggleSetting` - I used wrong name above, it's actually `Setting` with `.addToggle()`)
- **The callback chain** - `CreateItemModal` → `ModalHandler` → `createNewFile`. All need the parameter.
- **Template customization** - Consider making the default kanban template configurable in settings later.

### Testing
- Create normal note (toggle off) - should be blank
- Create kanban note (toggle on) - should have template
- Verify the created file opens correctly in embedded kanban view
- Test that toggle state doesn't persist between modal opens (should default to off)

---

## 3. Add Bookmark Toggle to Modals

### Goal
Add a bookmark icon button to `MarkdownEditorModal` and `ImagePreviewModal` headers that toggles the file's bookmark status.

### Files to Modify
- `src/components/MarkdownEditorModal.ts`
- `src/components/ImagePreviewModal.ts`
- `src/BookmarkService.ts`
- `styles/modals.css`

### Current Code Analysis

`BookmarkService.ts` currently only has read methods (`isBookmarked`, `getBookmarkedPaths`). You need to add write capability.

### Implementation

**Add to `BookmarkService.ts`:**

```typescript
/**
 * Add a file to bookmarks
 */
async addBookmark(path: string): Promise<boolean> {
    const plugin = this.getBookmarksPlugin();
    if (!plugin?.enabled || !plugin.instance) {
        new Notice('Bookmarks plugin is not enabled');
        return false;
    }
    
    try {
        // The internal API for adding bookmarks
        // @ts-ignore - Accessing internal API
        await plugin.instance.addItem({ type: 'file', path: path });
        return true;
    } catch (e) {
        console.error('Failed to add bookmark:', e);
        return false;
    }
}

/**
 * Remove a file from bookmarks
 */
async removeBookmark(path: string): Promise<boolean> {
    const plugin = this.getBookmarksPlugin();
    if (!plugin?.enabled || !plugin.instance) {
        return false;
    }
    
    try {
        // @ts-ignore - Accessing internal API
        const items = plugin.instance.items;
        const item = this.findBookmarkItem(items, path);
        if (item) {
            // @ts-ignore
            await plugin.instance.removeItem(item);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Failed to remove bookmark:', e);
        return false;
    }
}

/**
 * Toggle bookmark status
 */
async toggleBookmark(path: string): Promise<boolean> {
    if (this.isBookmarked(path)) {
        return this.removeBookmark(path);
    } else {
        return this.addBookmark(path);
    }
}

/**
 * Find a bookmark item by path (recursive for groups)
 */
private findBookmarkItem(items: BookmarkItem[], path: string): BookmarkItem | null {
    for (const item of items) {
        if (item.path === path) {
            return item;
        }
        if (item.type === 'group' && item.items) {
            const found = this.findBookmarkItem(item.items, path);
            if (found) return found;
        }
    }
    return null;
}
```

**In `MarkdownEditorModal.ts`:**

```typescript
import { BookmarkService } from '../BookmarkService';
import { Icons } from './Icons';

// In the class:
private bookmarkService: BookmarkService;
private bookmarkBtn: HTMLElement | null = null;

constructor(app: App, file: TFile) {
    super(app);
    this.file = file;
    this.bookmarkService = new BookmarkService(app);
}

// In onOpen(), add to the header/actions area:
private renderBookmarkButton(container: HTMLElement) {
    const isBookmarked = this.bookmarkService.isBookmarked(this.file.path);
    
    this.bookmarkBtn = container.createEl('button', {
        cls: `kanban-modal-bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}`,
        attr: { 'aria-label': isBookmarked ? 'Remove bookmark' : 'Add bookmark' }
    });
    this.bookmarkBtn.innerHTML = Icons.bookmark;
    
    this.bookmarkBtn.onclick = async () => {
        const success = await this.bookmarkService.toggleBookmark(this.file.path);
        if (success) {
            const nowBookmarked = this.bookmarkService.isBookmarked(this.file.path);
            this.bookmarkBtn?.toggleClass('is-bookmarked', nowBookmarked);
            this.bookmarkBtn?.setAttribute('aria-label', 
                nowBookmarked ? 'Remove bookmark' : 'Add bookmark'
            );
        }
    };
}
```

**In `styles/modals.css`:**

```css
.kanban-modal-bookmark-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--kanban-spacing-sm);
    border-radius: var(--kanban-radius-sm);
    color: var(--text-muted);
    transition: color var(--kanban-transition-fast);
}

.kanban-modal-bookmark-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
}

.kanban-modal-bookmark-btn.is-bookmarked {
    color: var(--interactive-accent);
}

.kanban-modal-bookmark-btn.is-bookmarked svg {
    fill: var(--interactive-accent);
}
```

### Watch Out For
- **Obsidian's bookmark API is internal** and undocumented. It may change between versions. Wrap in try/catch and fail gracefully.
- **The bookmark icon should have filled vs outline states** - update your SVG or use two different icons.
- **Refreshing the board** - After toggling a bookmark, if the user has "Bookmarks" filter active, the card should appear/disappear. You may need to trigger a refresh callback.
- **`ImagePreviewModal.ts`** - Apply the same pattern, but note this modal is simpler. Check its current structure first.

### Testing
- Toggle bookmark on/off in modal
- Verify bookmark appears in Obsidian's bookmarks panel
- Test with Bookmarks plugin disabled (should show notice or hide button)
- Test rapid clicking (debounce if needed)

---

## 4. Drag External Files Into Lists

### Goal
Allow dragging files from Obsidian's file explorer (and potentially external sources) into kanban lists to move them into that folder.

### Files to Modify
- `src/board/DragDropHandler.ts`
- `src/board/BoardRenderer.ts`

### Current Code Analysis

`DragDropHandler.ts` currently handles:
- `makeCardDraggable()` - makes internal cards draggable
- `setupDropZone()` - handles drops onto lists

The drop handler only looks for `this.draggedCard` (internal drags). You need to also handle external drags.

### Implementation

**In `DragDropHandler.ts`:**

```typescript
/**
 * Setup a container as a drop zone for cards
 */
setupDropZone(container: HTMLElement, listPath: string): void {
    container.ondragover = (e) => {
        e.preventDefault();
        
        // Check if this is a valid drop
        // Accept internal cards OR external files
        if (this.draggedCard || this.hasExternalFiles(e)) {
            container.addClass('kanban-drop-active');
        }
    };
    
    container.ondragleave = (e) => {
        // Only remove if actually leaving (not entering child)
        if (!container.contains(e.relatedTarget as Node)) {
            container.removeClass('kanban-drop-active');
        }
    };
    
    container.ondrop = async (e) => {
        e.preventDefault();
        container.removeClass('kanban-drop-active');
        
        // Handle internal card drag
        if (this.draggedCard && this.draggedCard.file) {
            await this.handleInternalDrop(listPath);
            return;
        }
        
        // Handle external file drag (from file explorer)
        await this.handleExternalDrop(e, listPath);
    };
}

/**
 * Check if drag event contains files
 */
private hasExternalFiles(e: DragEvent): boolean {
    if (!e.dataTransfer) return false;
    
    // Check for Obsidian internal file drag
    const obsidianData = e.dataTransfer.types.includes('text/plain');
    
    // Check for external files
    const hasFiles = e.dataTransfer.types.includes('Files');
    
    return obsidianData || hasFiles;
}

/**
 * Handle internal card being dropped
 */
private async handleInternalDrop(listPath: string): Promise<void> {
    if (!this.draggedCard?.file) return;
    
    const targetFolder = this.app.vault.getAbstractFileByPath(listPath);
    if (!(targetFolder instanceof TFolder)) return;
    
    const oldPath = this.draggedCard.file.path;
    const newPath = `${listPath}/${this.draggedCard.file.name}`;
    
    if (oldPath !== newPath) {
        try {
            await this.app.fileManager.renameFile(this.draggedCard.file, newPath);
            await this.onRefresh();
        } catch (err) {
            new Notice(`Failed to move file: ${err}`);
        }
    }
    
    this.draggedCard = null;
    this.draggedElement = null;
}

/**
 * Handle external file being dropped
 */
private async handleExternalDrop(e: DragEvent, listPath: string): Promise<void> {
    const targetFolder = this.app.vault.getAbstractFileByPath(listPath);
    if (!(targetFolder instanceof TFolder)) return;
    
    // Try to get Obsidian internal drag data first
    const obsidianPath = e.dataTransfer?.getData('text/plain');
    
    if (obsidianPath) {
        // This is a drag from Obsidian's file explorer
        const file = this.app.vault.getAbstractFileByPath(obsidianPath);
        
        if (file instanceof TFile) {
            const newPath = `${listPath}/${file.name}`;
            if (file.path !== newPath) {
                try {
                    await this.app.fileManager.renameFile(file, newPath);
                    await this.onRefresh();
                } catch (err) {
                    new Notice(`Failed to move file: ${err}`);
                }
            }
        } else if (file instanceof TFolder) {
            // Moving a folder into another folder
            const newPath = `${listPath}/${file.name}`;
            if (file.path !== newPath && !newPath.startsWith(file.path + '/')) {
                try {
                    await this.app.fileManager.renameFile(file, newPath);
                    await this.onRefresh();
                } catch (err) {
                    new Notice(`Failed to move folder: ${err}`);
                }
            }
        }
        return;
    }
    
    // Handle files dragged from outside Obsidian (OS file manager)
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const arrayBuffer = await file.arrayBuffer();
                const newPath = `${listPath}/${file.name}`;
                await this.app.vault.createBinary(newPath, arrayBuffer);
            } catch (err) {
                new Notice(`Failed to import ${file.name}: ${err}`);
            }
        }
        await this.onRefresh();
    }
}
```

### Watch Out For
- **Obsidian's internal drag format** - The file explorer uses `text/plain` with the file path. Test this works.
- **Folder into itself** - Prevent dropping a folder into its own subfolder (infinite recursion). Added check above but verify.
- **File name conflicts** - If a file with same name exists in target, `renameFile` will fail. Consider adding conflict resolution.
- **Large files from external** - `createBinary` loads entire file into memory. May be slow for large files.
- **Drop indicator styling** - The `kanban-drop-active` class should clearly show where the file will go.
- **The `ondragleave` event** fires when entering child elements. Added `contains` check but test thoroughly.

### Additional CSS

```css
/* Enhanced drop zone indicator */
.kanban-cards.kanban-drop-active {
    background: var(--background-modifier-hover);
    outline: 2px dashed var(--interactive-accent);
    outline-offset: -2px;
}
```

### Testing
- Drag card from one list to another (existing functionality)
- Drag file from Obsidian's file explorer into a list
- Drag folder from file explorer into a list
- Drag external file from desktop into a list
- Drag multiple external files
- Try to drop folder into itself (should fail gracefully)
- Drop file where same name exists

---

## 5. Toolbar/Breadcrumb UI Reorganization

### Goal
- Move search bar to breadcrumb row, aligned right
- Move date/tags filters to the right of filter chips
- Create space for saved filters
- Add horizontal scroll if saved filters overflow

### Files to Modify
- `src/board/ToolbarRenderer.ts`
- `src/KanbanView.ts` (render order)
- `styles/header.css`

### Current Structure

```
┌─────────────────────────────────────────────────────┐
│ [←] 🏠 Vault / Folder / Subfolder                   │  ← Header row
├─────────────────────────────────────────────────────┤
│ [All][Notes][Images][Files][Folders][Bookmarks]     │  ← Filter chips
│ [Tags ▾][Date ▾]  [3 filters ✕]                     │
│ [🔍 Search cards...]  [Sort: Name ▾]                │  ← Search/sort row
└─────────────────────────────────────────────────────┘
```

### New Structure

```
┌─────────────────────────────────────────────────────┐
│ [←] 🏠 Vault / Folder (42) / Subfolder (12)    [🔍] │  ← Header + search
├─────────────────────────────────────────────────────┤
│ [All][Notes]...[+Saved1][+Saved2]  [Tags▾][Date▾]   │  ← Filters (scrollable)
│ [Sort: Name ▾ ↑]  [3 filters ✕]                     │  ← Sort + indicator
└─────────────────────────────────────────────────────┘
```

### Implementation

**Restructure `ToolbarRenderer.ts`:**

```typescript
/**
 * Render breadcrumbs with integrated search (called from KanbanView)
 */
renderHeader(container: HTMLElement, folder: TFolder, state: BoardState, totalItems: number): void {
    const header = container.createEl('div', { cls: 'kanban-header' });

    // Left side: back button + breadcrumbs
    const leftSection = header.createEl('div', { cls: 'kanban-header-left' });
    
    if (state.history.length > 0) {
        const backBtn = leftSection.createEl('button', { 
            cls: 'kanban-back-btn',
            attr: { 'aria-label': 'Go back' }
        });
        backBtn.innerHTML = Icons.back;
        backBtn.onclick = () => this.callbacks.onNavigateBack();
    }

    this.renderBreadcrumbs(leftSection, state.currentPath, totalItems);

    // Right side: search
    const rightSection = header.createEl('div', { cls: 'kanban-header-right' });
    this.renderCompactSearch(rightSection, state.searchQuery);
}

/**
 * Render compact search for header
 */
private renderCompactSearch(container: HTMLElement, searchQuery: string): void {
    const searchContainer = container.createEl('div', { cls: 'kanban-search-compact' });
    
    const searchIcon = searchContainer.createEl('span', { cls: 'kanban-search-icon' });
    searchIcon.innerHTML = Icons.search;
    
    this.searchInputEl = searchContainer.createEl('input', {
        cls: 'kanban-search-input',
        attr: { 
            type: 'text', 
            placeholder: 'Search...'
        }
    });
    this.searchInputEl.value = searchQuery;
    
    // Same debounced search handler as before
    this.searchInputEl.oninput = (e) => {
        const input = e.target as HTMLInputElement;
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
            await this.callbacks.onSearchChange(input.value);
        }, 300);
    };
    
    if (searchQuery) {
        const clearBtn = searchContainer.createEl('span', { cls: 'kanban-search-clear' });
        clearBtn.innerHTML = Icons.close;
        clearBtn.onclick = async () => {
            if (this.searchInputEl) this.searchInputEl.value = '';
            await this.callbacks.onSearchChange('');
        };
    }
}

/**
 * Render main toolbar with filters
 */
renderToolbar(container: HTMLElement, state: BoardState, savedFilters: SavedFilter[]): void {
    const toolbar = container.createEl('div', { cls: 'kanban-toolbar' });
    
    // Scrollable filter section
    const filterSection = toolbar.createEl('div', { cls: 'kanban-filter-section' });
    
    // Default filter chips
    this.renderFilterChips(filterSection, state);
    
    // Saved filter chips (NEW)
    this.renderSavedFilterChips(filterSection, state, savedFilters);
    
    // Save filter button (NEW)
    this.renderSaveFilterButton(filterSection, state);
    
    // Spacer pushes rest to right
    filterSection.createEl('div', { cls: 'kanban-filter-spacer' });
    
    // Tag and Date dropdowns (moved to right)
    this.renderTagFilter(filterSection, state);
    this.renderDateFilter(filterSection, state);
    
    // Secondary row: sort + filter indicator
    const secondaryRow = toolbar.createEl('div', { cls: 'kanban-toolbar-secondary' });
    this.renderSortControls(secondaryRow, state);
    this.renderFilterIndicator(secondaryRow, state);
}
```

**In `styles/header.css`:**

```css
/* Header with breadcrumbs and search */
.kanban-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--kanban-spacing-md) var(--kanban-spacing-lg);
    border-bottom: 1px solid var(--background-modifier-border);
    gap: var(--kanban-spacing-lg);
}

.kanban-header-left {
    display: flex;
    align-items: center;
    gap: var(--kanban-spacing-sm);
    flex: 1;
    min-width: 0; /* Allow shrinking */
}

.kanban-header-right {
    flex-shrink: 0;
}

/* Compact search in header */
.kanban-search-compact {
    display: flex;
    align-items: center;
    background: var(--background-secondary);
    border-radius: var(--kanban-radius-md);
    padding: var(--kanban-spacing-xs) var(--kanban-spacing-sm);
    gap: var(--kanban-spacing-xs);
    width: 200px;
    transition: width var(--kanban-transition-normal);
}

.kanban-search-compact:focus-within {
    width: 280px;
    box-shadow: 0 0 0 2px var(--interactive-accent);
}

.kanban-search-compact .kanban-search-input {
    border: none;
    background: none;
    flex: 1;
    min-width: 0;
}

/* Toolbar with horizontal scroll */
.kanban-toolbar {
    padding: var(--kanban-spacing-sm) var(--kanban-spacing-lg);
    border-bottom: 1px solid var(--background-modifier-border);
}

.kanban-filter-section {
    display: flex;
    align-items: center;
    gap: var(--kanban-spacing-sm);
    overflow-x: auto;
    padding-bottom: var(--kanban-spacing-xs);
    scrollbar-width: thin;
}

/* Hide scrollbar but keep functionality */
.kanban-filter-section::-webkit-scrollbar {
    height: 4px;
}

.kanban-filter-section::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 2px;
}

.kanban-filter-spacer {
    flex: 1;
    min-width: var(--kanban-spacing-lg);
}

.kanban-toolbar-secondary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--kanban-spacing-sm);
}
```

### Watch Out For
- **Method signature changes** - `renderHeader` and `renderToolbar` need additional parameters. Update calls in `KanbanView.ts`.
- **Breaking the existing search functionality** - The search is moved but should work identically. Test debouncing still works.
- **Horizontal scroll on touch** - Test that filter section scrolls smoothly on mobile.
- **Focus states** - Search expanding on focus may push other elements. Test edge cases.
- **The `totalItems` parameter** - You need to calculate and pass this from `KanbanView`. See section 11.

### Testing
- Verify search works in new location
- Test with many saved filters (horizontal scroll appears)
- Check layout at various window widths
- Verify all filter interactions still work
- Test keyboard navigation to search (/ shortcut)

---

## 6. Save Filter Feature

### Goal
Add ability to save current filter state as a named preset, stored per-vault in plugin settings.

### Files to Modify
- `src/settings.ts` - Add saved filters to settings interface
- `src/types.ts` - Already has `SavedFilter` interface (enhance it)
- `src/board/ToolbarRenderer.ts` - Add save button and render saved chips
- `src/KanbanView.ts` - Handle save/load/delete callbacks
- `src/main.ts` - Pass settings to view

### Implementation

**Enhance `SavedFilter` in `types.ts`:**

```typescript
export interface SavedFilter {
    id: string;
    name: string;
    icon?: string;
    typeFilters: CardType[];
    tagFilters?: string[];
    tagFilterMode?: 'any' | 'all';
    dateFilter?: DateFilter;
    searchQuery?: string;
    isDefault?: boolean;  // For built-in filters
}

// Keep DEFAULT_SAVED_FILTERS but mark them as isDefault: true
export const DEFAULT_SAVED_FILTERS: SavedFilter[] = [
    { id: 'all', name: 'All', icon: 'layers', typeFilters: [], isDefault: true },
    // ... rest with isDefault: true
];
```

**Add to `settings.ts`:**

```typescript
export interface Kanban4000Settings {
    // ... existing settings
    savedFilters: SavedFilter[];
    showUndoNotifications: boolean;  // For undo feature
}

export const DEFAULT_SETTINGS: Kanban4000Settings = {
    // ... existing defaults
    savedFilters: [],
    showUndoNotifications: true,
};
```

**Add save button in `ToolbarRenderer.ts`:**

```typescript
/**
 * Render save filter button
 */
private renderSaveFilterButton(container: HTMLElement, state: BoardState): void {
    // Only show if there are active filters worth saving
    const hasFilters = state.typeFilters.length > 0 || 
                       state.tagFilters.length > 0 || 
                       state.dateFilter || 
                       state.searchQuery;
    
    const saveBtn = container.createEl('button', {
        cls: `kanban-save-filter-btn ${hasFilters ? '' : 'kanban-save-filter-btn-disabled'}`,
        attr: { 'aria-label': 'Save current filters' }
    });
    saveBtn.innerHTML = Icons.plus;
    
    if (hasFilters) {
        saveBtn.onclick = () => this.callbacks.onSaveFilter?.();
    }
}

/**
 * Render saved filter chips
 */
private renderSavedFilterChips(
    container: HTMLElement, 
    state: BoardState, 
    savedFilters: SavedFilter[]
): void {
    for (const filter of savedFilters) {
        if (filter.isDefault) continue; // Skip built-in filters
        
        const isActive = this.isSavedFilterActive(filter, state);
        
        const chip = container.createEl('button', {
            cls: `kanban-filter-chip kanban-filter-chip-saved ${isActive ? 'kanban-filter-chip-active' : ''}`
        });
        
        chip.createEl('span', { text: filter.name });
        
        // Delete button (visible on hover)
        const deleteBtn = chip.createEl('span', { 
            cls: 'kanban-filter-chip-delete',
            attr: { 'aria-label': 'Delete filter' }
        });
        deleteBtn.innerHTML = Icons.close;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.callbacks.onDeleteSavedFilter?.(filter.id);
        };
        
        chip.onclick = () => this.callbacks.onApplySavedFilter?.(filter);
    }
}

private isSavedFilterActive(filter: SavedFilter, state: BoardState): boolean {
    // Compare all filter properties
    const typeMatch = JSON.stringify(filter.typeFilters.sort()) === 
                      JSON.stringify(state.typeFilters.sort());
    const tagMatch = JSON.stringify(filter.tagFilters?.sort() || []) === 
                     JSON.stringify(state.tagFilters.sort());
    const dateMatch = JSON.stringify(filter.dateFilter) === 
                      JSON.stringify(state.dateFilter);
    const searchMatch = (filter.searchQuery || '') === state.searchQuery;
    
    return typeMatch && tagMatch && dateMatch && searchMatch;
}
```

**Add callbacks to `ToolbarCallbacks`:**

```typescript
export interface ToolbarCallbacks {
    // ... existing
    onSaveFilter?: () => void;
    onApplySavedFilter?: (filter: SavedFilter) => void;
    onDeleteSavedFilter?: (filterId: string) => void;
}
```

**Handle in `KanbanView.ts`:**

```typescript
// In constructor, add to toolbarRenderer callbacks:
onSaveFilter: () => this.showSaveFilterModal(),
onApplySavedFilter: (filter) => this.applySavedFilter(filter),
onDeleteSavedFilter: (id) => this.deleteSavedFilter(id),

// Methods:
private showSaveFilterModal(): void {
    // Create a simple modal asking for filter name
    const modal = new SaveFilterModal(this.app, async (name) => {
        const newFilter: SavedFilter = {
            id: `custom-${Date.now()}`,
            name: name,
            typeFilters: [...this.state.typeFilters],
            tagFilters: [...this.state.tagFilters],
            tagFilterMode: this.state.tagFilterMode,
            dateFilter: this.state.dateFilter ? { ...this.state.dateFilter } : undefined,
            searchQuery: this.state.searchQuery || undefined,
        };
        
        this.plugin.settings.savedFilters.push(newFilter);
        await this.plugin.saveSettings();
        await this.render();
    });
    modal.open();
}

private applySavedFilter(filter: SavedFilter): void {
    this.state.typeFilters = [...(filter.typeFilters || [])];
    this.state.tagFilters = [...(filter.tagFilters || [])];
    this.state.tagFilterMode = filter.tagFilterMode || 'any';
    this.state.dateFilter = filter.dateFilter ? { ...filter.dateFilter } : undefined;
    this.state.searchQuery = filter.searchQuery || '';
    this.render();
}

private async deleteSavedFilter(filterId: string): Promise<void> {
    this.plugin.settings.savedFilters = this.plugin.settings.savedFilters.filter(
        f => f.id !== filterId
    );
    await this.plugin.saveSettings();
    await this.render();
}
```

**Create `SaveFilterModal`** (new file or add to `CreateItemModal.ts`):

```typescript
class SaveFilterModal extends Modal {
    private name: string = '';
    private onSubmit: (name: string) => void;

    constructor(app: App, onSubmit: (name: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Save Filter' });
        
        const input = new TextComponent(contentEl)
            .setPlaceholder('Filter name')
            .onChange((value) => this.name = value);
        
        input.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.name) {
                this.onSubmit(this.name);
                this.close();
            }
        });
        
        const btnContainer = contentEl.createEl('div', { cls: 'kanban-modal-buttons' });
        
        btnContainer.createEl('button', { text: 'Cancel' })
            .onclick = () => this.close();
        
        const saveBtn = btnContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.onclick = () => {
            if (this.name) {
                this.onSubmit(this.name);
                this.close();
            }
        };
        
        setTimeout(() => input.inputEl.focus(), 10);
    }

    onClose() {
        this.contentEl.empty();
    }
}
```

### Watch Out For
- **Settings migration** - Existing users won't have `savedFilters` array. The `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` pattern handles this, but test upgrading.
- **Duplicate filter names** - Consider preventing or allowing duplicates.
- **Deep copying** - When saving/applying filters, ensure you're not creating reference issues. Use spread operators.
- **Render order** - `renderToolbar` now needs `savedFilters` parameter. Update calls in `KanbanView.render()`.

### Testing
- Save a filter with various combinations (type, tags, date, search)
- Apply saved filter - all states should update
- Delete saved filter
- Saved filters persist after restarting Obsidian
- Opening multiple vaults - filters should be separate per vault

---

## 7. Undo System

### Goal
Implement undo for destructive actions (move, delete, rename) with Ctrl+Z support and optional toast notifications.

### Files to Modify
- `src/main.ts` or create new `src/UndoManager.ts`
- `src/board/DragDropHandler.ts`
- `src/components/ContextMenu.ts`
- `src/settings.ts`

### Implementation

**Create `src/UndoManager.ts`:**

```typescript
import { App, Notice, TFile, TFolder, TAbstractFile } from 'obsidian';

export interface UndoAction {
    type: 'move' | 'delete' | 'rename' | 'create';
    description: string;
    undo: () => Promise<void>;
    timestamp: number;
}

export class UndoManager {
    private stack: UndoAction[] = [];
    private maxStackSize = 20;
    private showNotifications: boolean = true;
    private noticeTimeout: number = 5000;
    private currentNotice: Notice | null = null;

    constructor(private app: App) {}

    setShowNotifications(show: boolean): void {
        this.showNotifications = show;
    }

    /**
     * Push an undoable action onto the stack
     */
    push(action: UndoAction): void {
        this.stack.push(action);
        
        // Limit stack size
        if (this.stack.length > this.maxStackSize) {
            this.stack.shift();
        }
        
        // Show notification with undo button
        if (this.showNotifications) {
            this.showUndoNotice(action);
        }
    }

    /**
     * Undo the last action
     */
    async undo(): Promise<boolean> {
        const action = this.stack.pop();
        if (!action) {
            new Notice('Nothing to undo');
            return false;
        }

        try {
            await action.undo();
            new Notice(`Undone: ${action.description}`);
            return true;
        } catch (e) {
            new Notice(`Failed to undo: ${e}`);
            return false;
        }
    }

    /**
     * Check if there are actions to undo
     */
    canUndo(): boolean {
        return this.stack.length > 0;
    }

    /**
     * Get description of last action
     */
    getLastActionDescription(): string | null {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1].description : null;
    }

    /**
     * Show notification with undo button
     */
    private showUndoNotice(action: UndoAction): void {
        // Close previous notice if exists
        if (this.currentNotice) {
            this.currentNotice.hide();
        }

        // Create fragment with undo button
        const fragment = document.createDocumentFragment();
        
        const text = fragment.createEl('span', { text: action.description + ' ' });
        
        const undoBtn = fragment.createEl('a', { 
            text: 'Undo',
            cls: 'kanban-undo-link'
        });
        undoBtn.onclick = async (e) => {
            e.preventDefault();
            await this.undo();
            this.currentNotice?.hide();
        };
        
        this.currentNotice = new Notice(fragment, this.noticeTimeout);
    }

    /**
     * Create undo action for file move
     */
    createMoveAction(file: TAbstractFile, oldPath: string, newPath: string): UndoAction {
        const fileName = file.name;
        return {
            type: 'move',
            description: `Moved "${fileName}"`,
            timestamp: Date.now(),
            undo: async () => {
                const currentFile = this.app.vault.getAbstractFileByPath(newPath);
                if (currentFile) {
                    await this.app.fileManager.renameFile(currentFile, oldPath);
                }
            }
        };
    }

    /**
     * Create undo action for file delete (moved to trash)
     */
    createDeleteAction(file: TAbstractFile, originalPath: string): UndoAction {
        // Note: Obsidian's trash is in .trash folder
        // This is complex because we need to restore from trash
        return {
            type: 'delete',
            description: `Deleted "${file.name}"`,
            timestamp: Date.now(),
            undo: async () => {
                // Find file in trash
                const trashPath = `.trash/${file.name}`;
                const trashedFile = this.app.vault.getAbstractFileByPath(trashPath);
                
                if (trashedFile) {
                    await this.app.fileManager.renameFile(trashedFile, originalPath);
                } else {
                    throw new Error('File not found in trash');
                }
            }
        };
    }

    /**
     * Create undo action for rename
     */
    createRenameAction(file: TAbstractFile, oldPath: string, newPath: string): UndoAction {
        return {
            type: 'rename',
            description: `Renamed to "${file.name}"`,
            timestamp: Date.now(),
            undo: async () => {
                const currentFile = this.app.vault.getAbstractFileByPath(newPath);
                if (currentFile) {
                    await this.app.fileManager.renameFile(currentFile, oldPath);
                }
            }
        };
    }
}
```

**Integrate into `main.ts`:**

```typescript
import { UndoManager } from './UndoManager';

export default class Kanban4000Plugin extends Plugin {
    undoManager: UndoManager;
    
    async onload() {
        // ... existing code
        
        this.undoManager = new UndoManager(this.app);
        this.undoManager.setShowNotifications(this.settings.showUndoNotifications);
        
        // Register Ctrl+Z command
        this.addCommand({
            id: 'undo-last-action',
            name: 'Undo last Kanban action',
            callback: async () => {
                await this.undoManager.undo();
                this.refreshAllViews();
            },
            hotkeys: [{ modifiers: ['Mod'], key: 'z' }]
        });
    }
}
```

**Update `DragDropHandler.ts`:**

```typescript
constructor(
    private app: App,
    private onRefresh: () => Promise<void>,
    private undoManager?: UndoManager  // ADD THIS
) {}

// In handleInternalDrop:
const oldPath = this.draggedCard.file.path;
const newPath = `${listPath}/${this.draggedCard.file.name}`;

if (oldPath !== newPath) {
    try {
        // Create undo action BEFORE the move
        if (this.undoManager) {
            const action = this.undoManager.createMoveAction(
                this.draggedCard.file, oldPath, newPath
            );
            this.undoManager.push(action);
        }
        
        await this.app.fileManager.renameFile(this.draggedCard.file, newPath);
        await this.onRefresh();
    } catch (err) {
        new Notice(`Failed to move file: ${err}`);
    }
}
```

**Update `ContextMenu.ts` delete handler:**

```typescript
export async function deleteItem(
    app: App, 
    card: KanbanCard,
    undoManager?: UndoManager
): Promise<boolean> {
    const file = card.file || card.folder;
    if (!file) return false;

    // ... confirmation modal code ...
    
    // Inside the confirm callback:
    try {
        const originalPath = file.path;
        
        await app.vault.trash(file, true);
        
        // Push undo action AFTER successful delete
        if (undoManager) {
            const action = undoManager.createDeleteAction(file, originalPath);
            undoManager.push(action);
        }
        
        new Notice(`Moved "${card.title}" to trash`);
        resolve(true);
    } catch (e) {
        // ...
    }
}
```

**Add to settings:**

```typescript
// In settings.ts
new Setting(containerEl)
    .setName('Show undo notifications')
    .setDesc('Show a notification with undo button after moving or deleting files')
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showUndoNotifications)
        .onChange(async (value) => {
            this.plugin.settings.showUndoNotifications = value;
            this.plugin.undoManager.setShowNotifications(value);
            await this.plugin.saveSettings();
        }));
```

### Watch Out For
- **Ctrl+Z conflict** - Obsidian already uses Ctrl+Z for editor undo. Your command might conflict. Consider:
  - Only registering when Kanban view is focused
  - Using a different hotkey like `Ctrl+Shift+Z`
  - Checking if an editor is focused before handling
- **Trash folder structure** - Obsidian's `.trash` may have duplicate names. The undo might fail for files with common names.
- **Async timing** - Create undo action before the operation, but only push to stack after success.
- **Race conditions** - If user does multiple actions quickly, ensure stack order is correct.
- **Notice API** - The `new Notice(fragment, timeout)` with fragment is undocumented but works. Test it.

### Testing
- Move file, undo - file returns to original location
- Delete file, undo - file restored from trash
- Rename file, undo - file renamed back
- Ctrl+Z when nothing to undo - shows "Nothing to undo"
- Toggle notifications setting - notices appear/disappear
- Rapid actions - stack maintains correct order
- Undo after Obsidian restart - (stack won't persist, this is expected)

---

## 8. Keyboard Navigation

### Goal
Add arrow key navigation between cards, Enter to open, Tab between lists.

### Files to Modify
- `src/KanbanView.ts`
- `src/board/BoardRenderer.ts`
- `styles/cards.css`

### Implementation

**Add to `KanbanView.ts` keyboard handler:**

```typescript
private focusedCardIndex: { listIndex: number; cardIndex: number } | null = null;

private handleKeydown(e: KeyboardEvent) {
    // ... existing handlers ...
    
    // Arrow key navigation (when not in input)
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // ... existing escape handler ...
        return;
    }
    
    switch (e.key) {
        case 'ArrowRight':
            e.preventDefault();
            this.navigateCards('right');
            break;
            
        case 'ArrowLeft':
            if (this.focusedCardIndex) {
                e.preventDefault();
                this.navigateCards('left');
            } else if (this.state.history.length > 0) {
                // Fall through to existing back navigation
                e.preventDefault();
                this.navigateBack();
            }
            break;
            
        case 'ArrowDown':
            e.preventDefault();
            this.navigateCards('down');
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            this.navigateCards('up');
            break;
            
        case 'Enter':
            if (this.focusedCardIndex) {
                e.preventDefault();
                this.activateFocusedCard();
            }
            break;
            
        case 'Tab':
            if (this.focusedCardIndex) {
                e.preventDefault();
                this.navigateCards(e.shiftKey ? 'prevList' : 'nextList');
            }
            break;
            
        // ... existing cases ...
    }
}

private navigateCards(direction: 'up' | 'down' | 'left' | 'right' | 'nextList' | 'prevList'): void {
    const lists = this.contentEl.querySelectorAll('.kanban-list');
    if (lists.length === 0) return;
    
    // Initialize focus if not set
    if (!this.focusedCardIndex) {
        this.focusedCardIndex = { listIndex: 0, cardIndex: 0 };
    }
    
    let { listIndex, cardIndex } = this.focusedCardIndex;
    
    const getCardCount = (li: number): number => {
        const list = lists[li];
        return list?.querySelectorAll('.kanban-card').length || 0;
    };
    
    switch (direction) {
        case 'up':
            cardIndex = Math.max(0, cardIndex - 1);
            break;
            
        case 'down':
            cardIndex = Math.min(getCardCount(listIndex) - 1, cardIndex + 1);
            break;
            
        case 'left':
        case 'prevList':
            if (listIndex > 0) {
                listIndex--;
                cardIndex = Math.min(cardIndex, getCardCount(listIndex) - 1);
            }
            break;
            
        case 'right':
        case 'nextList':
            if (listIndex < lists.length - 1) {
                listIndex++;
                cardIndex = Math.min(cardIndex, getCardCount(listIndex) - 1);
            }
            break;
    }
    
    this.focusedCardIndex = { listIndex, cardIndex };
    this.updateCardFocus();
}

private updateCardFocus(): void {
    // Remove existing focus
    this.contentEl.querySelectorAll('.kanban-card-focused').forEach(el => {
        el.removeClass('kanban-card-focused');
    });
    
    if (!this.focusedCardIndex) return;
    
    const { listIndex, cardIndex } = this.focusedCardIndex;
    const lists = this.contentEl.querySelectorAll('.kanban-list');
    const list = lists[listIndex];
    
    if (list) {
        const cards = list.querySelectorAll('.kanban-card');
        const card = cards[cardIndex] as HTMLElement;
        
        if (card) {
            card.addClass('kanban-card-focused');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

private activateFocusedCard(): void {
    const focused = this.contentEl.querySelector('.kanban-card-focused');
    if (focused) {
        const path = focused.getAttribute('data-path');
        if (path) {
            // Find card data and trigger click
            // You'll need to store card references or look up by path
            focused.click();
        }
    }
}

// Reset focus when re-rendering
async render() {
    this.focusedCardIndex = null;
    // ... rest of render
}
```

**Add focus styles in `styles/cards.css`:**

```css
.kanban-card-focused {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.2);
}

/* Ensure cards can receive focus for accessibility */
.kanban-card {
    /* Already has tabindex via rendering, or add it */
}
```

**Update `BoardRenderer.ts` to add tabindex:**

```typescript
private renderCard(container: HTMLElement, card: KanbanCard, listPath: string): void {
    const cardEl = container.createEl('div', { 
        cls: `kanban-card kanban-card-${card.type}`,
        attr: { 
            'data-path': card.path,
            'tabindex': '0'  // ADD THIS
        }
    });
    // ... rest of rendering
}
```

### Watch Out For
- **Arrow left conflict** - Currently Arrow Left triggers "go back". Now it needs to navigate cards first, then go back only if at leftmost card with no focus or explicitly.
- **Focus persistence** - After render(), focus is lost. Consider re-focusing the same path if it still exists.
- **Scroll into view** - When focusing a card off-screen, scroll it into view.
- **Empty lists** - Handle lists with no cards (skip them during navigation).
- **"New Folder" list** - The placeholder list at the end shouldn't be navigable.

### Testing
- Arrow keys navigate between cards
- Enter opens the focused card
- Tab moves to next list
- Shift+Tab moves to previous list
- Focus visible styling is clear
- Card scrolls into view when focused
- Focus works after filtering/sorting

---

## 9. Mobile Friendly

### Assessment Areas
Quick check to see what needs work vs what works already.

### Files to Review
- `styles/responsive.css` - Already exists, check coverage
- `src/board/DragDropHandler.ts` - Touch events
- `src/board/BoardRenderer.ts` - Long-press for context menu

### Current State

Looking at your existing `responsive.css`, you have some mobile breakpoints. Check:

1. **Touch scrolling** - Should work naturally with CSS overflow
2. **Tap interactions** - Click handlers should work as taps
3. **Long-press context menu** - Needs implementation
4. **Drag and drop** - Needs touch event equivalents

### Minimal Mobile Fixes

**1. Long-press for context menu:**

```typescript
// In BoardRenderer.ts, renderCard method:

// Add touch support for context menu
let touchTimeout: NodeJS.Timeout | null = null;
let touchMoved = false;

cardEl.ontouchstart = (e) => {
    touchMoved = false;
    touchTimeout = setTimeout(() => {
        if (!touchMoved) {
            // Simulate right-click
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('contextmenu', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            this.callbacks.onCardContextMenu(mouseEvent, card);
        }
    }, 500); // 500ms long press
};

cardEl.ontouchmove = () => {
    touchMoved = true;
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
};

cardEl.ontouchend = () => {
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
};
```

**2. Disable drag on mobile (simplest approach):**

```typescript
// In DragDropHandler.ts
makeCardDraggable(cardEl: HTMLElement, card: KanbanCard): void {
    // Check if touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
        // Don't enable drag on touch devices for now
        // Could implement touch-drag later with touch events
        return;
    }
    
    cardEl.setAttribute('draggable', 'true');
    // ... rest of existing code
}
```

**3. CSS touch improvements:**

```css
/* In responsive.css */
@media (hover: none) and (pointer: coarse) {
    /* Touch device specific styles */
    
    /* Larger touch targets */
    .kanban-card {
        min-height: 60px;
    }
    
    .kanban-filter-chip {
        padding: 10px 14px;
    }
    
    .kanban-back-btn,
    .kanban-sort-direction {
        width: 44px;
        height: 44px;
    }
    
    /* Disable hover effects that don't make sense on touch */
    .kanban-card:hover {
        transform: none;
    }
    
    .kanban-card-thumbnail-overlay {
        opacity: 1; /* Always show on touch */
    }
}
```

### Extensive Refactoring (Future)
If mobile needs more work, these would require significant effort:
- Touch-based drag and drop
- Mobile-optimized layout (single column view?)
- Swipe gestures
- Better modal sizing on small screens

### Testing
- Open on iOS Safari
- Open on Android Chrome
- Tap cards (should open)
- Long-press cards (should show context menu)
- Scroll horizontally through lists
- Test modals fit on screen

---

## 10. Double-Click List Header to Rename

### Goal
Double-clicking a list header opens rename dialog for the folder.

### Files to Modify
- `src/board/BoardRenderer.ts`
- `src/components/ContextMenu.ts` (reuse `renameItem`)

### Implementation

**In `BoardRenderer.ts`:**

```typescript
private renderList(board: HTMLElement, list: KanbanList): void {
    // ... existing code ...
    
    const headerEl = listEl.createEl('div', { cls: 'kanban-list-header' });
    
    // ... existing header rendering ...
    
    // Add double-click to rename (only for folder lists, not loose files)
    if (!list.isLooseFiles) {
        headerEl.ondblclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.handleListRename(list);
        };
        
        // Change cursor to indicate editable
        headerEl.style.cursor = 'pointer';
    }
}

private async handleListRename(list: KanbanList): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(list.path);
    if (!(folder instanceof TFolder)) return;
    
    // Reuse the rename modal from ContextMenu
    const renamed = await this.showRenameModal(folder, list.title);
    if (renamed) {
        await this.callbacks.onRender();
    }
}

private showRenameModal(folder: TFolder, currentName: string): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = new RenameModal(this.app, currentName, async (newName) => {
            if (!newName || newName === currentName) {
                resolve(false);
                return;
            }

            try {
                const parentPath = folder.parent?.path || '';
                const newPath = parentPath ? `${parentPath}/${newName}` : newName;
                await this.app.fileManager.renameFile(folder, newPath);
                new Notice(`Renamed to "${newName}"`);
                resolve(true);
            } catch (e) {
                new Notice(`Failed to rename: ${e}`);
                resolve(false);
            }
        });
        modal.open();
    });
}
```

### Watch Out For
- **Import `RenameModal`** - It's currently defined inside `ContextMenu.ts`. Consider exporting it or moving to shared location.
- **Single-click navigation** - List headers already have onclick for navigation. Double-click should not trigger single-click. Use a timeout pattern or check event timing.
- **Loose files list** - The "loose files" list represents the current folder, not a subfolder. Renaming it would rename the current location, which might be confusing. Skip this list.

**Preventing single-click on double-click:**

```typescript
let clickTimeout: NodeJS.Timeout | null = null;

headerEl.onclick = (e) => {
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        return; // This was a double-click, ignore
    }
    
    clickTimeout = setTimeout(() => {
        clickTimeout = null;
        // Single click action - navigate
        this.callbacks.onNavigateTo(list.path);
    }, 250);
};

headerEl.ondblclick = async (e) => {
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    e.preventDefault();
    e.stopPropagation();
    await this.handleListRename(list);
};
```

### Testing
- Single click still navigates into folder
- Double click opens rename modal
- Rename updates the list header
- Loose files list header is not double-clickable
- Rapid clicking doesn't cause issues

---

## 11. Card Count in Breadcrumbs

### Goal
Show total item count next to each breadcrumb segment, e.g., "Vault (42) / Projects (12) / Active (3)"

### Files to Modify
- `src/board/ToolbarRenderer.ts`
- `src/KanbanView.ts` (pass counts to renderer)

### Implementation

**Calculate counts in `KanbanView.ts`:**

```typescript
async render() {
    // ... existing code ...
    
    const currentFolder = this.getCurrentFolder();
    if (!currentFolder) {
        // ... error handling ...
        return;
    }
    
    // Calculate item count for current folder
    const totalItems = this.countItemsInFolder(currentFolder);
    
    // Pass to header renderer
    this.toolbarRenderer.renderHeader(this.contentEl, currentFolder, this.state, totalItems);
    
    // ... rest of render ...
}

private countItemsInFolder(folder: TFolder): number {
    let count = 0;
    const children = folder.children || [];
    
    for (const child of children) {
        if (child.name.startsWith('.')) continue;
        if (this.plugin.settings.excludePatterns.some(
            p => child.name.toLowerCase() === p.toLowerCase()
        )) continue;
        
        count++;
    }
    
    return count;
}
```

**Update breadcrumb rendering in `ToolbarRenderer.ts`:**

```typescript
/**
 * Render breadcrumb navigation with counts
 */
private renderBreadcrumbs(
    header: HTMLElement, 
    currentPath: string, 
    currentCount: number
): void {
    const breadcrumbs = header.createEl('div', { cls: 'kanban-breadcrumbs' });
    
    // Root crumb with count
    const rootCrumb = breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb' });
    rootCrumb.createEl('span', { text: '🏠 Vault' });
    
    // Only show root count if we're at root
    if (currentPath === '/') {
        rootCrumb.createEl('span', { 
            cls: 'kanban-breadcrumb-count',
            text: ` (${currentCount})`
        });
    }
    
    rootCrumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(0);

    if (currentPath !== '/') {
        const parts = currentPath.split('/').filter(p => p);
        
        for (let i = 0; i < parts.length; i++) {
            breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb-separator', text: ' / ' });
            
            const crumb = breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb' });
            crumb.createEl('span', { text: parts[i] });
            
            // Add count to current (last) breadcrumb
            if (i === parts.length - 1) {
                crumb.createEl('span', { 
                    cls: 'kanban-breadcrumb-count',
                    text: ` (${currentCount})`
                });
                crumb.addClass('kanban-breadcrumb-current');
            } else {
                const crumbIndex = i + 1;
                crumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(crumbIndex);
            }
        }
    }
}
```

**Add styles:**

```css
.kanban-breadcrumb-count {
    color: var(--text-muted);
    font-size: 0.85em;
    font-weight: normal;
}
```

### Watch Out For
- **Performance** - Counting items is fast, but don't count on every keystroke. Only on render.
- **Showing counts for intermediate breadcrumbs** - This would require fetching counts for each parent folder. For simplicity, only show count for current folder. Could enhance later.
- **Method signature change** - `renderBreadcrumbs` and `renderHeader` now take a count parameter. Update all callers.

### Testing
- Count shows correctly at vault root
- Count updates when navigating into folders
- Count updates after creating/deleting files
- Count respects exclude patterns

---

## 12. Open in File Explorer Context Menu

### Goal
Add "Reveal in system explorer" option to folder context menu that opens the folder in Finder/Explorer.

### Files to Modify
- `src/components/ContextMenu.ts`

### Implementation

**In `ContextMenu.ts`, update `buildFolderMenu`:**

```typescript
import { Platform } from 'obsidian';

private buildFolderMenu(menu: Menu, card: KanbanCard) {
    // ... existing menu items ...
    
    menu.addSeparator();
    
    // Reveal in system file explorer
    menu.addItem((item) => {
        item
            .setTitle(Platform.isMacOS ? 'Reveal in Finder' : 'Show in Explorer')
            .setIcon('folder-open')
            .onClick(() => this.revealInSystemExplorer(card));
    });
    
    // ... rest of menu ...
}

private revealInSystemExplorer(card: KanbanCard): void {
    const folder = card.folder;
    if (!folder) return;
    
    // Get the vault's base path
    const vaultPath = (this.app.vault.adapter as any).basePath;
    if (!vaultPath) {
        new Notice('Cannot determine vault location');
        return;
    }
    
    const fullPath = `${vaultPath}/${folder.path}`;
    
    // Use Electron's shell module to open in system explorer
    const { shell } = require('electron');
    shell.showItemInFolder(fullPath);
}
```

### Watch Out For
- **Electron availability** - This uses Electron's `shell` module, which is only available in desktop Obsidian, not mobile. Add a check:

```typescript
// Check if we're in desktop environment
if (!Platform.isDesktop) {
    return; // Don't add this menu item on mobile
}
```

- **Vault adapter type** - The `basePath` property is on `FileSystemAdapter`, not all adapters. The type assertion `(this.app.vault.adapter as any).basePath` works but isn't type-safe.
- **Path separators** - On Windows, paths use backslashes. `shell.showItemInFolder` should handle this, but test.
- **Sandboxed environments** - Some Obsidian installations might be sandboxed. The shell command might fail.

### Also add to file context menu:

```typescript
private buildFileMenu(menu: Menu, card: KanbanCard) {
    // ... existing items ...
    
    if (Platform.isDesktop) {
        menu.addItem((item) => {
            item
                .setTitle(Platform.isMacOS ? 'Reveal in Finder' : 'Show in Explorer')
                .setIcon('folder-open')
                .onClick(() => this.revealFileInSystemExplorer(card));
        });
    }
}

private revealFileInSystemExplorer(card: KanbanCard): void {
    const file = card.file;
    if (!file) return;
    
    const vaultPath = (this.app.vault.adapter as any).basePath;
    if (!vaultPath) {
        new Notice('Cannot determine vault location');
        return;
    }
    
    const fullPath = `${vaultPath}/${file.path}`;
    
    const { shell } = require('electron');
    shell.showItemInFolder(fullPath);
}
```

### Testing
- Right-click folder → "Reveal in Finder/Explorer" opens system file manager
- Right-click file → same functionality
- Test on macOS (Finder)
- Test on Windows (Explorer)
- Test on Linux (should open default file manager)
- Menu item doesn't appear on mobile

---

## Development Order Recommendation

Based on dependencies and complexity:

1. **Fix modal width** - Quick win, no dependencies
2. **Card count in breadcrumbs** - Quick, sets up count infrastructure
3. **Double-click to rename** - Quick, reuses existing modal
4. **Open in File Explorer** - Quick, isolated feature
5. **Toolbar UI reorganization** - Foundation for saved filters
6. **Improve create note modal** - Moderate, isolated
7. **Add bookmark toggle** - Moderate, needs BookmarkService updates
8. **Save filter feature** - Depends on #5 UI changes
9. **Drag external files** - Moderate complexity
10. **Undo system** - Moderate, touches multiple files
11. **Keyboard navigation** - Moderate, needs careful focus management
12. **Mobile friendly** - Last, assess scope after other changes

---

## General Tips

1. **Test after each feature** - Don't implement everything then test
2. **Commit frequently** - One feature per commit for easy rollback
3. **Watch for regressions** - Each change can break existing features
4. **Keep TypeScript strict** - Fix type errors as you go
5. **Mobile testing** - Test periodically, not just at the end

Good luck with the development! 🚀
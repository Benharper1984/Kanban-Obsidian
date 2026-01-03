# View Plugin Development Guide

This guide explains how to create a new view plugin for the Vault Navigator ecosystem.

## Quick Start

### 1. Create Plugin Structure

```bash
mkdir vault-navigator-myview
cd vault-navigator-myview
npm init -y
```

### 2. Install Dependencies

```bash
npm install obsidian@latest --save-dev
npm install vault-navigator-core --save-peer
npm install typescript esbuild --save-dev
```

### 3. Create manifest.json

```json
{
    "id": "vault-navigator-myview",
    "name": "Vault Navigator - My View",
    "version": "1.0.0",
    "minAppVersion": "1.0.0",
    "description": "My custom view for Vault Navigator",
    "author": "Your Name",
    "authorUrl": "https://github.com/yourusername",
    "isDesktopOnly": false
}
```

### 4. Implement the Plugin

```typescript
// src/main.ts
import { Plugin, Notice } from 'obsidian';
import { MyViewPlugin } from './MyViewPlugin';

export default class MyViewPluginMain extends Plugin {
    private viewPlugin: MyViewPlugin;
    
    async onload() {
        // Get core reference
        const core = (window as any).NavigatorCore;
        
        if (!core) {
            new Notice(
                'Vault Navigator Core is required. ' +
                'Please install it first.'
            );
            return;
        }
        
        // Create and register view plugin
        this.viewPlugin = new MyViewPlugin();
        core.registerViewPlugin(this.viewPlugin);
        
        console.log('My View plugin loaded');
    }
    
    onunload() {
        const core = (window as any).NavigatorCore;
        if (core && this.viewPlugin) {
            core.unregisterViewPlugin(this.viewPlugin.manifest.id);
        }
    }
}
```

---

## NavigatorViewPlugin Interface

Every view plugin must implement the `NavigatorViewPlugin` interface:

```typescript
import { WorkspaceLeaf } from 'obsidian';
import { 
    NavigatorViewPlugin, 
    NavigatorCore, 
    NavigatorView,
    VaultItem 
} from 'vault-navigator-core';

export class MyViewPlugin implements NavigatorViewPlugin {
    // Required: Plugin identity
    manifest = {
        id: 'myview',           // Unique identifier
        name: 'My View',        // Display name
        icon: 'layout-grid',    // Lucide icon name
        description: 'Custom view description'
    };
    
    private core: NavigatorCore;
    
    // Called when plugin registers with core
    onRegister(core: NavigatorCore): void {
        this.core = core;
        // Initialize resources, register commands, etc.
    }
    
    // Called when plugin unregisters
    onUnregister(): void {
        // Cleanup resources
    }
    
    // Create the view instance
    createView(leaf: WorkspaceLeaf): NavigatorView {
        return new MyNavigatorView(leaf, this.core);
    }
    
    // Declare which metadata your view needs
    // Core will ensure this metadata is extracted
    requiredMetadata(): ('geo' | 'dates' | 'links' | 'tags')[] {
        return ['tags', 'links'];
    }
    
    // Filter: Can this view display a specific item?
    canDisplayItem(item: VaultItem): boolean {
        // Return false to hide items that don't fit your view
        // Example: Map view hides items without geo data
        return true;
    }
    
    // Return currently highlighted items (for cross-view sync)
    getHighlightedItems(): string[] {
        return [];
    }
}
```

---

## NavigatorView Interface

The view class handles rendering and interactions:

```typescript
import { 
    NavigatorView, 
    NavigatorCore,
    VaultItem, 
    ViewState, 
    FilterState 
} from 'vault-navigator-core';
import { WorkspaceLeaf } from 'obsidian';

export class MyNavigatorView implements NavigatorView {
    private container: HTMLElement;
    private items: VaultItem[] = [];
    private state: ViewState;
    
    constructor(
        private leaf: WorkspaceLeaf,
        private core: NavigatorCore
    ) {
        // Get the content container
        this.container = leaf.containerEl.children[1] as HTMLElement;
        this.container.addClass('my-view-container');
    }
    
    // Main render method - called by core
    render(items: VaultItem[], state: ViewState): void {
        this.items = items;
        this.state = state;
        
        // Clear and rebuild UI
        this.container.empty();
        
        // Your rendering logic here
        for (const item of items) {
            this.renderItem(item);
        }
        
        // Apply state (selection, focus, etc.)
        if (state.focusedItem) {
            this.highlightItem(state.focusedItem);
        }
    }
    
    private renderItem(item: VaultItem): void {
        const el = this.container.createEl('div', {
            cls: 'my-view-item',
            text: item.title
        });
        
        // Handle click
        el.addEventListener('click', () => {
            this.onItemSelect(item.path);
        });
        
        // Show metadata
        if (item.metadata.tags.length > 0) {
            el.createEl('span', {
                cls: 'my-view-tags',
                text: item.metadata.tags.join(', ')
            });
        }
    }
    
    // Called when user selects an item
    onItemSelect(path: string): void {
        // Notify core - this syncs all views
        this.core.updateSharedState({ 
            focusedItem: path,
            selectedItems: [path]
        });
    }
    
    // Called when filters change
    onFilterChange(filters: FilterState): void {
        // Re-fetch items with new filters
        this.core.getItems({ filters }).then(items => {
            this.render(items, this.state);
        });
    }
    
    // Return current state (for save/restore)
    getState(): ViewState {
        return {
            ...this.state,
            viewSpecific: {
                // Your view-specific state
                scrollPosition: this.container.scrollTop,
                zoom: 1.0
            }
        };
    }
    
    // Restore state (on view reopen)
    setState(state: ViewState): void {
        this.state = state;
        
        // Restore view-specific state
        if (state.viewSpecific?.scrollPosition) {
            this.container.scrollTop = state.viewSpecific.scrollPosition;
        }
    }
    
    // Cleanup when view closes
    cleanup(): void {
        this.container.empty();
        // Remove event listeners, cleanup resources
    }
    
    // Helper: highlight an item
    private highlightItem(path: string): void {
        const items = this.container.querySelectorAll('.my-view-item');
        items.forEach(el => {
            el.removeClass('highlighted');
            if (el.dataset.path === path) {
                el.addClass('highlighted');
            }
        });
    }
}
```

---

## Working with VaultItem

The `VaultItem` interface provides all the data your view needs:

```typescript
interface VaultItem {
    // Identity
    path: string;           // Full path: "folder/subfolder/note.md"
    title: string;          // Display name: "note"
    type: 'file' | 'folder' | 'link';
    
    // Obsidian references (when available)
    file?: TFile;
    folder?: TFolder;
    
    // Rich metadata
    metadata: ItemMetadata;
}

interface ItemMetadata {
    // Tags (frontmatter + inline)
    tags: string[];         // ["project", "status/active"]
    
    // Links
    links: LinkInfo[];      // Outgoing links
    backlinks: LinkInfo[];  // Incoming links
    
    // Dates
    created: Date;
    modified: Date;
    dates?: DateReference[];  // Dates in content
    
    // Location
    geo?: GeoLocation;
    
    // Raw frontmatter
    frontmatter: Record<string, unknown>;
}
```

### Accessing Metadata

```typescript
function processItem(item: VaultItem) {
    // Basic info
    console.log(`Title: ${item.title}`);
    console.log(`Path: ${item.path}`);
    console.log(`Type: ${item.type}`);
    
    // Tags
    if (item.metadata.tags.includes('important')) {
        // Handle important items
    }
    
    // Links (for graph/mindmap views)
    for (const link of item.metadata.links) {
        console.log(`Links to: ${link.target}`);
        console.log(`Resolved: ${link.resolved}`);
    }
    
    // Geo (for map views)
    if (item.metadata.geo) {
        const { lat, lng, name } = item.metadata.geo;
        // Place on map
    }
    
    // Dates (for timeline views)
    for (const dateRef of item.metadata.dates || []) {
        console.log(`Date: ${dateRef.date}`);
        console.log(`Type: ${dateRef.type}`);  // created, deadline, event, etc.
        console.log(`Context: ${dateRef.context}`);
    }
    
    // Custom frontmatter
    const customField = item.metadata.frontmatter.myCustomField;
}
```

---

## Working with State

### Reading State

```typescript
const state = this.core.getSharedState();

// Current focus
if (state.focusedItem) {
    this.scrollToItem(state.focusedItem);
}

// Selected items
for (const path of state.selectedItems) {
    this.highlightItem(path);
}

// Active filters
if (state.filters.search) {
    this.filterBySearch(state.filters.search);
}

if (state.filters.tags.length > 0) {
    this.filterByTags(state.filters.tags);
}
```

### Updating State

```typescript
// Focus an item (all views will highlight it)
this.core.updateSharedState({ 
    focusedItem: item.path 
});

// Select multiple items
this.core.updateSharedState({ 
    selectedItems: [item1.path, item2.path] 
});

// Update filters (all views will re-filter)
this.core.updateSharedState({ 
    filters: {
        ...this.core.getSharedState().filters,
        tags: ['project', 'active']
    }
});
```

### Subscribing to State Changes

```typescript
class MyNavigatorView implements NavigatorView {
    private unsubscribe: () => void;
    
    constructor(leaf: WorkspaceLeaf, core: NavigatorCore) {
        // Subscribe to state changes
        this.unsubscribe = core.on('state-change', (event) => {
            this.onStateChange(event.current);
        });
    }
    
    private onStateChange(state: ViewState): void {
        // React to changes from other views
        if (state.focusedItem) {
            this.highlightItem(state.focusedItem);
        }
    }
    
    cleanup(): void {
        // Don't forget to unsubscribe!
        this.unsubscribe();
    }
}
```

---

## Styling Your View

### Using Core CSS Variables

```css
/* styles/myview.css */

.my-view-container {
    padding: var(--nav-spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--nav-spacing-sm);
}

.my-view-item {
    padding: var(--nav-spacing-sm) var(--nav-spacing-md);
    border-radius: var(--radius-s);
    border: 1px solid var(--nav-border-color);
    cursor: pointer;
    transition: var(--nav-transition-fast);
}

.my-view-item:hover {
    background: var(--background-modifier-hover);
}

.my-view-item.highlighted {
    background: var(--nav-selection-bg);
    border-color: var(--nav-highlight-color);
}

.my-view-item.focused {
    box-shadow: 0 0 0 2px var(--nav-highlight-color);
}
```

### Available CSS Variables

```css
:root {
    /* Spacing */
    --nav-spacing-xs: 4px;
    --nav-spacing-sm: 8px;
    --nav-spacing-md: 12px;
    --nav-spacing-lg: 16px;
    --nav-spacing-xl: 24px;
    
    /* Transitions */
    --nav-transition-fast: 150ms ease;
    --nav-transition-normal: 250ms ease;
    --nav-transition-slow: 400ms ease;
    
    /* Colors (inherit Obsidian theme) */
    --nav-highlight-color: var(--interactive-accent);
    --nav-selection-bg: var(--background-modifier-active-hover);
    --nav-border-color: var(--background-modifier-border);
    
    /* View transitions */
    --nav-view-transition: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Common Patterns

### Filtering Items

```typescript
async refreshWithFilters(): Promise<void> {
    const state = this.core.getSharedState();
    
    // Get items matching current filters
    const items = await this.core.getItems({
        filters: state.filters,
        includeMetadata: this.requiredMetadata()
    });
    
    // Only show items this view can display
    const displayable = items.filter(item => 
        this.canDisplayItem(item)
    );
    
    this.render(displayable, state);
}
```

### Opening Files

```typescript
private async openItem(item: VaultItem): Promise<void> {
    if (item.file) {
        // Open in a new leaf
        const leaf = this.core.app.workspace.getLeaf('tab');
        await leaf.openFile(item.file);
    }
}
```

### Context Menus

```typescript
private showContextMenu(event: MouseEvent, item: VaultItem): void {
    const menu = new Menu();
    
    menu.addItem((menuItem) => {
        menuItem
            .setTitle('Open')
            .setIcon('file')
            .onClick(() => this.openItem(item));
    });
    
    menu.addItem((menuItem) => {
        menuItem
            .setTitle('Open in new tab')
            .setIcon('file-plus')
            .onClick(() => {
                const leaf = this.core.app.workspace.getLeaf('tab');
                if (item.file) leaf.openFile(item.file);
            });
    });
    
    menu.addSeparator();
    
    menu.addItem((menuItem) => {
        menuItem
            .setTitle('Reveal in Kanban')
            .setIcon('layout-dashboard')
            .onClick(() => {
                this.core.navigateToItem(item.path, { 
                    viewId: 'kanban',
                    highlight: true 
                });
            });
    });
    
    menu.showAtMouseEvent(event);
}
```

### Keyboard Navigation

```typescript
private setupKeyboardNav(): void {
    this.container.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
                this.selectNext();
                e.preventDefault();
                break;
            case 'ArrowUp':
                this.selectPrevious();
                e.preventDefault();
                break;
            case 'Enter':
                this.openSelected();
                e.preventDefault();
                break;
        }
    });
}
```

---

## Testing Your Plugin

### Manual Testing Checklist

- [ ] Plugin loads without errors
- [ ] View appears in view switcher
- [ ] Items render correctly
- [ ] Selection syncs to other views
- [ ] Filters work correctly
- [ ] State persists across view close/reopen
- [ ] Performance acceptable with large vaults
- [ ] Works without core (graceful fallback)

### Debug Logging

```typescript
const DEBUG = true;

function debug(...args: any[]): void {
    if (DEBUG) {
        console.log('[MyView]', ...args);
    }
}

// Usage
debug('Rendering', items.length, 'items');
debug('State changed:', state);
```

---

## Publishing Your Plugin

1. **Test thoroughly** with different vaults and themes
2. **Document** your view's features and requirements
3. **Add screenshots** to your README
4. **Specify peer dependency** on `vault-navigator-core`
5. **Submit** to Obsidian community plugins

### README Template

```markdown
# Vault Navigator - My View

A [description] view for the Vault Navigator ecosystem.

## Features

- Feature 1
- Feature 2

## Requirements

- Obsidian v1.0.0+
- Vault Navigator Core v1.0.0+

## Installation

1. Install Vault Navigator Core
2. Install this plugin
3. Enable both plugins

## Usage

[Screenshots and usage instructions]

## Configuration

[Settings if any]
```

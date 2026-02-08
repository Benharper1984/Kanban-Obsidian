import { ItemView, WorkspaceLeaf, TFolder } from 'obsidian';
import Kanban4000Plugin from './main';
import { KanbanCard, BoardState, SortOption, CardType, DateFilter, SavedFilter } from './types';
import { 
CardContextMenu, 
renameItem, 
deleteItem, 
copyPath, 
revealInNavigation,
ImagePreviewModal,
SaveFilterModal
} from './components';
import { 
BoardBuilder, 
BoardRenderer, 
ToolbarRenderer, 
CardActionHandler, 
ModalHandler 
} from './board';
import { CoreBoardBuilder, CoreStateSync, applyHighlighting } from './core-integration';
import { ViewState } from './core-integration/types';

export const VIEW_TYPE_KANBAN = 'kanban-4000-view';

export class KanbanView extends ItemView {
plugin: Kanban4000Plugin;
state: BoardState;
contentEl: HTMLElement;

private keyHandler: (e: KeyboardEvent) => void;
private contextMenu: CardContextMenu;
private boardBuilder: BoardBuilder;
private coreBoardBuilder: CoreBoardBuilder;
private boardRenderer: BoardRenderer;
private toolbarRenderer: ToolbarRenderer;
private cardActionHandler: CardActionHandler;
private modalHandler: ModalHandler;
private stateSync: CoreStateSync | null = null;
private stateUnsubscribe: (() => void) | null = null;

// Render throttling state
private pendingRender: boolean = false;
private pendingRefresh: boolean = false;
private renderFrameId: number | null = null;
private initialized: boolean = false;

// Keyboard navigation state
private focusedCardIndex: { listIndex: number; cardIndex: number } | null = null;

constructor(leaf: WorkspaceLeaf, plugin: Kanban4000Plugin) {
super(leaf);
this.plugin = plugin;

// Initialize state with settings defaults
this.state = {
currentPath: plugin.settings?.rootFolder || '/',
history: [],
searchQuery: '',
sortBy: plugin.settings?.defaultSortBy || 'name',
sortDirection: plugin.settings?.defaultSortDirection || 'asc',
typeFilters: [],
showBookmarksOnly: false,
tagFilters: [],
tagFilterMode: 'any'
};

// Setup keyboard handler
this.keyHandler = this.handleKeydown.bind(this);

// Initialize context menu with callbacks
this.contextMenu = new CardContextMenu(this.app, {
onRename: async (card) => {
const renamed = await renameItem(this.app, card, this.plugin.undoManager);
if (renamed) await this.render();
},
onDelete: async (card) => {
const deleted = await deleteItem(this.app, card, this.plugin.undoManager);
if (deleted) await this.render();
},
onOpenInNewTab: async (card) => {
if (card.file) {
await this.app.workspace.getLeaf('tab').openFile(card.file);
}
},
onOpenInNewPane: async (card) => {
if (card.file) {
await this.app.workspace.getLeaf('split', 'vertical').openFile(card.file);
}
},
onRevealInNavigation: (card) => revealInNavigation(this.app, card),
onCopyPath: (card) => copyPath(card),
onNavigateTo: async (path) => this.navigateTo(path)
});

// Initialize board builder (legacy)
this.boardBuilder = new BoardBuilder(
this.app,
plugin.settings?.excludePatterns || []
);

// Initialize core board builder (uses Navigator Core when available)
this.coreBoardBuilder = new CoreBoardBuilder(
this.app,
plugin.settings?.excludePatterns || []
);

// Initialize modal handler
this.modalHandler = new ModalHandler(this.app, async () => this.render());

// Initialize card action handler
this.cardActionHandler = new CardActionHandler(this.app, {
onNavigateTo: async (path) => this.navigateTo(path),
onRender: async () => this.render()
});

// Initialize board renderer
this.boardRenderer = new BoardRenderer(this.app, plugin, {
onNavigateTo: async (path) => this.navigateTo(path),
onShowCreateFileModal: (folderPath) => this.modalHandler.showCreateFileModalInFolder(folderPath),
onShowCreateFolderModal: () => this.modalHandler.showCreateFolderModal(this.getCurrentFolder()),
onCardClick: async (card) => this.handleCardClick(card),
onCardContextMenu: (e, card) => this.contextMenu.show(e, card),
onTagClick: async (tag) => {
this.state.searchQuery = tag;
await this.render();
},
onImagePreview: (card) => {
if (card.file) {
new ImagePreviewModal(this.app, card.file).open();
}
},
onRender: async () => this.render()
});

// Initialize toolbar renderer
this.toolbarRenderer = new ToolbarRenderer({
onSearchChange: async (query) => {
this.state.searchQuery = query;
// Sync search with Navigator Core if connected
this.syncSearchWithCore(query);
await this.refreshBoard();
},
onSortChange: async (sortBy) => {
this.state.sortBy = sortBy;
await this.render();
},
onSortDirectionToggle: async () => {
this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
await this.render();
},
onTypeFilterChange: async (types: CardType[]) => {
this.state.typeFilters = types;
// Clear bookmark filter when selecting a type filter
this.state.showBookmarksOnly = false;
await this.render();
},
onBookmarkFilterToggle: async (active: boolean) => {
this.state.showBookmarksOnly = active;
// Clear all filters when enabling bookmarks filter for consistency
if (active) {
	this.state.typeFilters = [];
	this.state.tagFilters = [];
	this.state.dateFilter = undefined;
	this.state.searchQuery = '';
}
await this.render();
},
onTagFilterChange: async (tags: string[], mode: 'any' | 'all') => {
this.state.tagFilters = tags;
this.state.tagFilterMode = mode;
await this.render();
},
onDateFilterChange: async (filter: DateFilter | undefined) => {
this.state.dateFilter = filter;
await this.render();
},
onClearAllFilters: async () => {
this.state.typeFilters = [];
this.state.tagFilters = [];
this.state.tagFilterMode = 'any';
this.state.dateFilter = undefined;
this.state.showBookmarksOnly = false;
this.state.searchQuery = '';
await this.render();
},
onNavigateBack: async () => this.navigateBack(),
onNavigateToBreadcrumb: async (index) => this.navigateToBreadcrumb(index),
// Saved filter callbacks
onSaveFilter: () => this.showSaveFilterModal(),
onApplySavedFilter: (filter) => this.applySavedFilter(filter),
onDeleteSavedFilter: (id) => this.deleteSavedFilter(id)
});

// Get CoreStateSync from plugin's view plugin
this.stateSync = this.plugin.getStateSync();
if (this.stateSync) {
this.stateUnsubscribe = this.stateSync.onStateChange((state) => {
this.onCoreStateChange(state);
});
}
}

/**
 * Handle card click - notify Navigator Core if connected
 */
private async handleCardClick(card: KanbanCard): Promise<void> {
// Notify Navigator Core of selection via CoreStateSync
if (this.stateSync) {
this.stateSync.setFocusedItem(card.path);
}

// Handle the card action
await this.cardActionHandler.handleCardClick(card, this.contentEl);
}

/**
 * Sync search query with Navigator Core
 */
private syncSearchWithCore(query: string): void {
if (this.stateSync) {
this.stateSync.syncSearch(query);
}
}

/**
 * Handle Navigator Core state changes (cross-view highlighting)
 */
private onCoreStateChange(state: ViewState): void {
if (!this.contentEl || !this.initialized) return;

// Use centralized highlighting function
applyHighlighting(this.contentEl, state);

// Sync search if changed externally
if (state.filters?.search !== undefined && state.filters.search !== this.state.searchQuery) {
this.state.searchQuery = state.filters.search;
this.toolbarRenderer.setSearchQuery(state.filters.search);
this.refreshBoard();
}
}

getViewType(): string {
return VIEW_TYPE_KANBAN;
}

getDisplayText(): string {
const folderName = this.state.currentPath === '/' 
? 'Vault Root' 
: this.state.currentPath.split('/').pop() || 'Kanban';
return `Kanban: ${folderName}`;
}

getIcon(): string {
return 'layout-dashboard';
}

async onOpen() {
this.contentEl = this.containerEl.children[1] as HTMLElement;
this.contentEl.empty();
this.contentEl.addClass('kanban-4000-container');

if (this.plugin.settings?.enableAnimations) {
this.contentEl.addClass('kanban-animations-enabled');
}

if (this.plugin.settings?.wrapLists) {
this.contentEl.addClass('kanban-grid-mode');
}

this.containerEl.addEventListener('keydown', this.keyHandler);
await this.render();
this.initialized = true;
}

async onClose() {
// Cancel any pending renders
if (this.renderFrameId) {
cancelAnimationFrame(this.renderFrameId);
this.renderFrameId = null;
}

// Unsubscribe from Navigator Core
if (this.stateUnsubscribe) {
this.stateUnsubscribe();
this.stateUnsubscribe = null;
}

this.containerEl.removeEventListener('keydown', this.keyHandler);
this.contentEl.empty();
}

private handleKeydown(e: KeyboardEvent) {
if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
if (e.key === 'Escape') {
(e.target as HTMLElement).blur();
e.preventDefault();
}
return;
}

const searchInput = this.toolbarRenderer.getSearchInput();

switch (e.key) {
case 'ArrowUp':
e.preventDefault();
this.navigateCards('up');
break;

case 'ArrowDown':
e.preventDefault();
this.navigateCards('down');
break;

case 'ArrowRight':
e.preventDefault();
this.navigateCards('right');
break;

case 'ArrowLeft':
// Navigate cards first, then go back if at edge or no focus
if (this.focusedCardIndex && this.focusedCardIndex.listIndex > 0) {
e.preventDefault();
this.navigateCards('left');
} else if (this.state.history.length > 0) {
e.preventDefault();
this.clearCardFocus();
this.navigateBack();
}
break;

case 'Backspace':
if (this.state.history.length > 0) {
e.preventDefault();
this.clearCardFocus();
this.navigateBack();
}
break;

case 'Tab':
if (this.focusedCardIndex) {
e.preventDefault();
this.navigateCards(e.shiftKey ? 'prevList' : 'nextList');
}
break;

case 'Enter':
if (this.focusedCardIndex) {
e.preventDefault();
this.activateFocusedCard();
}
break;

case 'Escape':
e.preventDefault();
if (this.focusedCardIndex) {
this.clearCardFocus();
} else if (this.cardActionHandler.hasEmbeddedKanban()) {
this.cardActionHandler.closeEmbeddedKanban(this.contentEl);
} else if (this.state.searchQuery) {
this.state.searchQuery = '';
this.render();
}
break;

case '/':
e.preventDefault();
this.clearCardFocus();
searchInput?.focus();
break;

case 'f':
if (e.ctrlKey || e.metaKey) {
e.preventDefault();
this.clearCardFocus();
searchInput?.focus();
}
break;

case 'r':
if (!e.ctrlKey && !e.metaKey) {
e.preventDefault();
this.render();
}
break;

case 'Home':
e.preventDefault();
this.clearCardFocus();
this.state.history = [];
this.state.currentPath = this.plugin.settings?.rootFolder || '/';
this.render();
break;
}
}

/**
 * Navigate between cards using keyboard
 */
private navigateCards(direction: 'up' | 'down' | 'left' | 'right' | 'nextList' | 'prevList'): void {
const lists = this.contentEl.querySelectorAll('.kanban-list:not(.kanban-new-folder-list)');
if (lists.length === 0) return;

// Initialize focus if not set
if (!this.focusedCardIndex) {
this.focusedCardIndex = { listIndex: 0, cardIndex: 0 };
this.updateCardFocus();
return;
}

let { listIndex, cardIndex } = this.focusedCardIndex;

const getCardCount = (li: number): number => {
const list = lists[li];
return list?.querySelectorAll('.kanban-card').length || 0;
};

// Find next non-empty list in direction
const findNextNonEmptyList = (startIndex: number, delta: number): number => {
let idx = startIndex + delta;
while (idx >= 0 && idx < lists.length) {
if (getCardCount(idx) > 0) return idx;
idx += delta;
}
return startIndex; // Stay at current if no non-empty found
};

switch (direction) {
case 'up':
if (cardIndex > 0) {
cardIndex--;
} else if (listIndex > 0) {
// Wrap to previous list's last card
const newListIndex = findNextNonEmptyList(listIndex, -1);
if (newListIndex !== listIndex) {
listIndex = newListIndex;
cardIndex = Math.max(0, getCardCount(listIndex) - 1);
}
}
break;

case 'down':
if (cardIndex < getCardCount(listIndex) - 1) {
cardIndex++;
} else if (listIndex < lists.length - 1) {
// Wrap to next list's first card
const newListIndex = findNextNonEmptyList(listIndex, 1);
if (newListIndex !== listIndex) {
listIndex = newListIndex;
cardIndex = 0;
}
}
break;

case 'left':
case 'prevList':
if (listIndex > 0) {
const newListIndex = findNextNonEmptyList(listIndex, -1);
if (newListIndex !== listIndex) {
listIndex = newListIndex;
cardIndex = Math.min(cardIndex, getCardCount(listIndex) - 1);
}
}
break;

case 'right':
case 'nextList':
if (listIndex < lists.length - 1) {
const newListIndex = findNextNonEmptyList(listIndex, 1);
if (newListIndex !== listIndex) {
listIndex = newListIndex;
cardIndex = Math.min(cardIndex, getCardCount(listIndex) - 1);
}
}
break;
}

// Ensure cardIndex is valid
cardIndex = Math.max(0, Math.min(cardIndex, getCardCount(listIndex) - 1));

this.focusedCardIndex = { listIndex, cardIndex };
this.updateCardFocus();
}

/**
 * Update the visual focus indicator on cards
 */
private updateCardFocus(): void {
// Remove existing focus
this.contentEl.querySelectorAll('.kanban-card-focused').forEach(el => {
el.removeClass('kanban-card-focused');
});

if (!this.focusedCardIndex) return;

const { listIndex, cardIndex } = this.focusedCardIndex;
const lists = this.contentEl.querySelectorAll('.kanban-list:not(.kanban-new-folder-list)');
const list = lists[listIndex];

if (list) {
const cards = list.querySelectorAll('.kanban-card');
const card = cards[cardIndex] as HTMLElement;

if (card) {
card.addClass('kanban-card-focused');
card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
card.focus();
}
}
}

/**
 * Clear card focus
 */
private clearCardFocus(): void {
this.focusedCardIndex = null;
this.contentEl.querySelectorAll('.kanban-card-focused').forEach(el => {
el.removeClass('kanban-card-focused');
});
}

/**
 * Activate (click) the focused card
 */
private activateFocusedCard(): void {
const focused = this.contentEl.querySelector('.kanban-card-focused') as HTMLElement;
if (focused) {
focused.click();
}
}

async setState(state: { folderPath?: string }, result: { history?: unknown }): Promise<void> {
if (state.folderPath) {
this.state.currentPath = state.folderPath;
}
await this.render();
}

getState(): { folderPath: string } {
return { folderPath: this.state.currentPath };
}

async navigateTo(path: string) {
this.state.history.push(this.state.currentPath);
this.state.currentPath = path;
(this.leaf as any).updateHeader?.();
await this.render();
}

async navigateBack() {
if (this.state.history.length > 0) {
const previousPath = this.state.history.pop()!;
this.state.currentPath = previousPath;
(this.leaf as any).updateHeader?.();
await this.render();
}
}

async navigateToBreadcrumb(index: number) {
const parts = this.state.currentPath === '/' ? [''] : this.state.currentPath.split('/');
const targetPath = index === 0 ? '/' : parts.slice(0, index).join('/');

if (targetPath !== this.state.currentPath) {
this.state.history.push(this.state.currentPath);
this.state.currentPath = targetPath;
(this.leaf as any).updateHeader?.();
await this.render();
}
}

/**
 * Save current scroll and selection state
 */
private saveViewState(): { scrollTop: number; scrollLeft: number; focusedPath: string | null } {
const board = this.contentEl.querySelector('.kanban-board');
const focused = this.contentEl.querySelector('.kanban-card-highlighted');
return {
scrollTop: board?.scrollTop ?? 0,
scrollLeft: board?.scrollLeft ?? 0,
focusedPath: focused?.getAttribute('data-path') ?? null
};
}

/**
 * Restore scroll and selection state
 */
private restoreViewState(savedState: { scrollTop: number; scrollLeft: number; focusedPath: string | null }): void {
const board = this.contentEl.querySelector('.kanban-board');
if (board) {
board.scrollTop = savedState.scrollTop;
board.scrollLeft = savedState.scrollLeft;
}
// Refocus card if it still exists
if (savedState.focusedPath) {
const card = this.contentEl.querySelector(`[data-path="${savedState.focusedPath}"]`);
if (card) {
card.addClass('kanban-card-highlighted');
}
}
}

/**
 * Queue a board refresh (throttled)
 * Use this for filter/sort changes that don't need full re-render
 */
queueRefresh(): void {
if (this.pendingRefresh) return;
this.pendingRefresh = true;

if (this.renderFrameId) {
cancelAnimationFrame(this.renderFrameId);
}

this.renderFrameId = requestAnimationFrame(async () => {
await this.refreshBoard();
this.pendingRefresh = false;
this.renderFrameId = null;
});
}

/**
 * Queue a full render (throttled)
 * Use this for navigation or structural changes
 */
queueRender(): void {
if (this.pendingRender) return;
this.pendingRender = true;

if (this.renderFrameId) {
cancelAnimationFrame(this.renderFrameId);
}

this.renderFrameId = requestAnimationFrame(async () => {
await this.render();
this.pendingRender = false;
this.renderFrameId = null;
});
}

async refreshBoard() {
const currentFolder = this.getCurrentFolder();
if (!currentFolder) return;

// Save state before refresh
const savedState = this.saveViewState();

const oldBoard = this.contentEl.querySelector('.kanban-board');
if (oldBoard) {
oldBoard.remove();
}

// Use CoreBoardBuilder which will use Navigator Core when available
const lists = await this.coreBoardBuilder.buildBoard(currentFolder);
const processedLists = this.coreBoardBuilder.processLists(lists, this.state);
this.boardRenderer.renderBoard(this.contentEl, processedLists, this.state.searchQuery);

// Restore state after refresh
this.restoreViewState(savedState);

// Apply highlighting from shared state if connected
if (this.stateSync) {
const sharedState = this.stateSync.getState();
applyHighlighting(this.contentEl, sharedState);
}
}

async render() {
// Skip render if in embedded kanban mode - the embedded view handles its own updates
if (this.cardActionHandler.isInEmbeddedMode()) {
return;
}

// Reset keyboard navigation focus on full render
this.focusedCardIndex = null;

this.contentEl.empty();

// Reapply container classes after empty()
this.contentEl.addClass('kanban-4000-container');
if (this.plugin.settings?.enableAnimations) {
this.contentEl.addClass('kanban-animations-enabled');
}
if (this.plugin.settings?.wrapLists) {
this.contentEl.addClass('kanban-grid-mode');
} else {
this.contentEl.removeClass('kanban-grid-mode');
}

const cardWidth = this.plugin.settings?.cardWidth ?? 280;
this.contentEl.style.setProperty('--kanban-card-width', `${cardWidth}px`);

const currentFolder = this.getCurrentFolder();
if (!currentFolder) {
this.contentEl.createEl('div', { 
cls: 'kanban-error',
text: 'Folder not found' 
});
return;
}

// Calculate item count for current folder
const itemCount = this.countItemsInFolder(currentFolder);

this.toolbarRenderer.renderHeader(this.contentEl, currentFolder, this.state, itemCount);

// Use CoreBoardBuilder which will use Navigator Core when available
const lists = await this.coreBoardBuilder.buildBoard(currentFolder);

// Collect all available tags from the board for the tag filter dropdown
const allCards = lists.flatMap(list => list.cards);
const availableTags = this.coreBoardBuilder.collectAllTags(allCards);
this.toolbarRenderer.setAvailableTags(availableTags);

this.toolbarRenderer.renderToolbar(this.contentEl, this.state, this.plugin.settings?.savedFilters || []);

const processedLists = this.coreBoardBuilder.processLists(lists, this.state);
this.boardRenderer.renderBoard(this.contentEl, processedLists, this.state.searchQuery);

// Apply highlighting from shared state if connected
if (this.stateSync) {
const sharedState = this.stateSync.getState();
applyHighlighting(this.contentEl, sharedState);
}
}

/**
 * Show modal to save current filter configuration
 */
private showSaveFilterModal(): void {
// Get current search from input (may differ from state if typed after last render)
const currentSearch = this.toolbarRenderer.getSearchInput()?.value || this.state.searchQuery;

const modal = new SaveFilterModal(this.app, async (name) => {
const newFilter: SavedFilter = {
id: `custom-${Date.now()}`,
name: name,
typeFilters: [...this.state.typeFilters],
tagFilters: this.state.tagFilters.length > 0 ? [...this.state.tagFilters] : undefined,
tagFilterMode: this.state.tagFilterMode,
dateFilter: this.state.dateFilter ? { ...this.state.dateFilter } : undefined,
searchQuery: currentSearch || undefined,
};

this.plugin.settings.savedFilters.push(newFilter);
await this.plugin.saveSettings();
// Note: saveSettings() already triggers refreshAllViews(), no need to call render() here
});
modal.open();
}

/**
 * Apply a saved filter to the current state
 */
private async applySavedFilter(filter: SavedFilter): Promise<void> {
this.state.typeFilters = [...(filter.typeFilters || [])];
this.state.tagFilters = [...(filter.tagFilters || [])];
this.state.tagFilterMode = filter.tagFilterMode || 'any';
this.state.dateFilter = filter.dateFilter ? { ...filter.dateFilter } : undefined;
this.state.searchQuery = filter.searchQuery || '';
this.state.showBookmarksOnly = false; // Clear bookmark filter when applying saved filter
await this.render();
}

/**
 * Delete a saved filter by ID
 */
private async deleteSavedFilter(filterId: string): Promise<void> {
this.plugin.settings.savedFilters = this.plugin.settings.savedFilters.filter(
f => f.id !== filterId
);
await this.plugin.saveSettings();
await this.render();
}

private getCurrentFolder(): TFolder | null {
const currentFolder = this.state.currentPath === '/' 
? this.app.vault.getRoot()
: this.app.vault.getAbstractFileByPath(this.state.currentPath);

if (currentFolder instanceof TFolder) {
return currentFolder;
}
return null;
}

/**
 * Count visible items in a folder (respects exclude patterns)
 */
private countItemsInFolder(folder: TFolder): number {
let count = 0;
const children = folder.children || [];
const excludePatterns = this.plugin.settings?.excludePatterns || [];

for (const child of children) {
// Skip hidden files
if (child.name.startsWith('.')) continue;

// Skip excluded patterns
const isExcluded = excludePatterns.some(
pattern => child.name.toLowerCase() === pattern.toLowerCase()
);
if (isExcluded) continue;

count++;
}

return count;
}
}

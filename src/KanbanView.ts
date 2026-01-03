import { ItemView, WorkspaceLeaf, TFolder } from 'obsidian';
import Kanban4000Plugin from './main';
import { KanbanCard, BoardState, SortOption, CardType } from './types';
import { 
CardContextMenu, 
renameItem, 
deleteItem, 
copyPath, 
revealInNavigation,
ImagePreviewModal
} from './components';
import { 
BoardBuilder, 
BoardRenderer, 
ToolbarRenderer, 
CardActionHandler, 
ModalHandler 
} from './board';
import { CoreBoardBuilder } from './core-integration';

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
private stateUnsubscribe: (() => void) | null = null;

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
typeFilters: []
};

// Setup keyboard handler
this.keyHandler = this.handleKeydown.bind(this);

// Initialize context menu with callbacks
this.contextMenu = new CardContextMenu(this.app, {
onRename: async (card) => {
const renamed = await renameItem(this.app, card);
if (renamed) await this.render();
},
onDelete: async (card) => {
const deleted = await deleteItem(this.app, card);
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
await this.refreshBoard();
},
onNavigateBack: async () => this.navigateBack(),
onNavigateToBreadcrumb: async (index) => this.navigateToBreadcrumb(index)
});

// Subscribe to Navigator Core state changes if connected
this.subscribeToCore();
}

/**
 * Handle card click - notify Navigator Core if connected
 */
private async handleCardClick(card: KanbanCard): Promise<void> {
// Notify Navigator Core of selection
const core = this.plugin.getNavigatorCore();
if (core) {
core.updateSharedState({ focusedItem: card.path });
}

// Handle the card action
await this.cardActionHandler.handleCardClick(card, this.contentEl);
}

/**
 * Sync search query with Navigator Core
 */
private syncSearchWithCore(query: string): void {
const core = this.plugin.getNavigatorCore();
if (core) {
core.updateFilters({ search: query });
}
}

/**
 * Subscribe to Navigator Core state changes
 */
private subscribeToCore(): void {
const core = this.plugin.getNavigatorCore();
if (core) {
this.stateUnsubscribe = core.on('state-change', (payload: any) => {
this.onCoreStateChange(payload.current);
});
}
}

/**
 * Handle Navigator Core state changes (cross-view highlighting)
 */
private onCoreStateChange(state: any): void {
if (!this.contentEl) return;

// Update highlighting
this.updateHighlighting(state.focusedItem, state.selectedItems || []);

// Sync search if changed externally
if (state.filters?.search !== undefined && state.filters.search !== this.state.searchQuery) {
this.state.searchQuery = state.filters.search;
this.toolbarRenderer.setSearchQuery(state.filters.search);
this.refreshBoard();
}
}

/**
 * Update card highlighting based on shared state
 */
private updateHighlighting(focusedItem?: string, selectedItems: string[] = []): void {
// Remove existing highlights
this.contentEl.querySelectorAll('.kanban-card-highlighted').forEach(el => {
el.removeClass('kanban-card-highlighted');
});
this.contentEl.querySelectorAll('.kanban-card-selected').forEach(el => {
el.removeClass('kanban-card-selected');
});

// Add highlight to focused item
if (focusedItem) {
const focusedCard = this.contentEl.querySelector(`[data-path="${focusedItem}"]`);
if (focusedCard) {
focusedCard.addClass('kanban-card-highlighted');
// Scroll into view if not visible
(focusedCard as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
}

// Add selection styling to selected items
for (const path of selectedItems) {
const selectedCard = this.contentEl.querySelector(`[data-path="${path}"]`);
if (selectedCard) {
selectedCard.addClass('kanban-card-selected');
}
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

this.containerEl.addEventListener('keydown', this.keyHandler);
await this.render();
}

async onClose() {
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
case 'Backspace':
case 'ArrowLeft':
if (this.state.history.length > 0) {
e.preventDefault();
this.navigateBack();
}
break;

case 'Escape':
e.preventDefault();
if (this.cardActionHandler.hasEmbeddedKanban()) {
this.cardActionHandler.closeEmbeddedKanban(this.contentEl);
} else if (this.state.searchQuery) {
this.state.searchQuery = '';
this.render();
}
break;

case '/':
e.preventDefault();
searchInput?.focus();
break;

case 'f':
if (e.ctrlKey || e.metaKey) {
e.preventDefault();
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
this.state.history = [];
this.state.currentPath = this.plugin.settings?.rootFolder || '/';
this.render();
break;
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

async refreshBoard() {
const currentFolder = this.getCurrentFolder();
if (!currentFolder) return;

const oldBoard = this.contentEl.querySelector('.kanban-board');
if (oldBoard) {
oldBoard.remove();
}

// Use CoreBoardBuilder which will use Navigator Core when available
const lists = await this.coreBoardBuilder.buildBoard(currentFolder);
const processedLists = this.coreBoardBuilder.processLists(lists, this.state);
this.boardRenderer.renderBoard(this.contentEl, processedLists, this.state.searchQuery);
}

async render() {
this.contentEl.empty();

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

this.toolbarRenderer.renderHeader(this.contentEl, currentFolder, this.state);
this.toolbarRenderer.renderToolbar(this.contentEl, this.state);

// Use CoreBoardBuilder which will use Navigator Core when available
const lists = await this.coreBoardBuilder.buildBoard(currentFolder);
const processedLists = this.coreBoardBuilder.processLists(lists, this.state);
this.boardRenderer.renderBoard(this.contentEl, processedLists, this.state.searchQuery);

// Apply highlighting from shared state if connected
const core = this.plugin.getNavigatorCore();
if (core) {
const sharedState = core.getSharedState();
this.updateHighlighting(sharedState.focusedItem, sharedState.selectedItems);
}
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
}

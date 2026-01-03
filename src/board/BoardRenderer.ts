import { App, TFile, TFolder } from 'obsidian';
import { KanbanList, KanbanCard } from '../types';
import { Icons, getCardIcon } from '../components';
import { DragDropHandler } from './DragDropHandler';
import Kanban4000Plugin from '../main';

export interface BoardRendererCallbacks {
	onNavigateTo: (path: string) => Promise<void>;
	onShowCreateFileModal: (folderPath: string) => void;
	onShowCreateFolderModal: () => void;
	onCardClick: (card: KanbanCard, cardEl?: HTMLElement) => Promise<void>;
	onCardContextMenu: (e: MouseEvent, card: KanbanCard) => void;
	onTagClick: (tag: string) => Promise<void>;
	onImagePreview: (card: KanbanCard) => void;
	onRender: () => Promise<void>;
}

/**
 * BoardRenderer handles rendering the kanban board, lists, and cards.
 */
export class BoardRenderer {
	private dragDropHandler: DragDropHandler;

	constructor(
		private app: App,
		private plugin: Kanban4000Plugin,
		private callbacks: BoardRendererCallbacks
	) {
		this.dragDropHandler = new DragDropHandler(app, callbacks.onRender);
	}

	/**
	 * Render the kanban board with all lists
	 */
	renderBoard(container: HTMLElement, lists: KanbanList[], searchQuery: string): void {
		const board = container.createEl('div', { cls: 'kanban-board' });

		if (lists.length === 0 && searchQuery) {
			board.createEl('div', { 
				cls: 'kanban-empty',
				text: 'No cards match your search' 
			});
			return;
		}

		for (const list of lists) {
			this.renderList(board, list);
		}

		// Add "New Folder" placeholder list at the end (only when not searching)
		if (!searchQuery) {
			this.renderNewFolderList(board);
		}
	}

	/**
	 * Render the "New Folder" placeholder list
	 */
	private renderNewFolderList(board: HTMLElement): void {
		const newFolderList = board.createEl('div', { cls: 'kanban-list kanban-new-folder-list' });
		
		const newFolderBtn = newFolderList.createEl('button', { 
			cls: 'kanban-new-folder-btn',
			attr: { 'aria-label': 'Create new folder' }
		});
		
		const iconEl = newFolderBtn.createEl('span', { cls: 'kanban-new-folder-icon' });
		iconEl.innerHTML = Icons.folderPlus;
		newFolderBtn.createEl('span', { text: 'New Folder' });
		
		newFolderBtn.onclick = () => this.callbacks.onShowCreateFolderModal();
	}

	/**
	 * Render a single list (column)
	 */
	private renderList(board: HTMLElement, list: KanbanList): void {
		const listEl = board.createEl('div', { 
			cls: `kanban-list ${list.isLooseFiles ? 'kanban-list-loose-files' : 'kanban-list-folder'}`,
			attr: { 'data-path': list.path }
		});
		
		// List header - clickable to open folder
		const headerEl = listEl.createEl('div', { cls: 'kanban-list-header' });
		
		// Add list type indicator
		const typeIndicator = headerEl.createEl('span', { cls: 'kanban-list-type-indicator' });
		if (list.isLooseFiles) {
			typeIndicator.innerHTML = Icons.filesIcon;
			typeIndicator.setAttribute('aria-label', 'Loose files in this folder');
		} else {
			typeIndicator.innerHTML = Icons.folder;
			typeIndicator.setAttribute('aria-label', 'Subfolder');
		}
		
		// Title container
		const titleContainer = headerEl.createEl('div', { cls: 'kanban-list-title-container' });
		
		titleContainer.createEl('span', { 
			cls: 'kanban-list-title',
			text: list.title 
		});
		
		// Add type label for loose files
		if (list.isLooseFiles) {
			titleContainer.createEl('span', { 
				cls: 'kanban-list-type-label',
				text: 'Files' 
			});
		}
		
		// Make header clickable to navigate into the folder (unless it's the loose files list)
		if (!list.isLooseFiles) {
			headerEl.addClass('kanban-list-header-clickable');
			headerEl.onclick = () => this.callbacks.onNavigateTo(list.path);
		}
		
		headerEl.createEl('span', { 
			cls: 'kanban-list-count',
			text: `${list.cards.length}` 
		});

		// Cards container with drag & drop
		const cardsEl = listEl.createEl('div', { cls: 'kanban-cards' });
		
		// Setup drop zone for the list
		this.dragDropHandler.setupDropZone(cardsEl, list.path);

		for (const card of list.cards) {
			this.renderCard(cardsEl, card, list.path);
		}

		// Add "New Note" button at the bottom of the list
		const newNoteBtn = cardsEl.createEl('button', { 
			cls: 'kanban-new-note-btn',
			attr: { 'aria-label': 'Create new note in this folder' }
		});
		const newNoteIcon = newNoteBtn.createEl('span', { cls: 'kanban-new-note-icon' });
		newNoteIcon.innerHTML = Icons.plus;
		newNoteBtn.createEl('span', { text: 'New Note' });
		newNoteBtn.onclick = () => this.callbacks.onShowCreateFileModal(list.path);
	}

	/**
	 * Render a single card
	 */
	private renderCard(container: HTMLElement, card: KanbanCard, listPath: string): void {
		const cardEl = container.createEl('div', { 
			cls: `kanban-card kanban-card-${card.type}`,
			attr: { 'data-path': card.path }
		});

		// Add context menu (right-click)
		cardEl.oncontextmenu = (e) => {
			this.callbacks.onCardContextMenu(e, card);
		};

		// Make file cards draggable
		if (card.type !== 'folder') {
			this.dragDropHandler.makeCardDraggable(cardEl, card);
		}

		// Card header (always visible)
		const headerEl = cardEl.createEl('div', { cls: 'kanban-card-header' });
		
		// Card icon
		const iconEl = headerEl.createEl('span', { cls: 'kanban-card-icon' });
		iconEl.innerHTML = getCardIcon(card.type);

		// Card title
		headerEl.createEl('span', { 
			cls: 'kanban-card-title',
			text: card.title 
		});

		// Show kanban indicator if file has kanban syntax
		if (card.type === 'markdown' && card.hasKanbanSyntax) {
			const kanbanIndicator = headerEl.createEl('span', { 
				cls: 'kanban-card-kanban-indicator',
				attr: { 'aria-label': 'Click to view kanban board' }
			});
			kanbanIndicator.innerHTML = Icons.kanbanGrid;
		}

		// Render tags
		this.renderCardTags(cardEl, card);

		// Preview text for markdown (if enabled in settings)
		this.renderCardPreview(cardEl, card);

		// Mini kanban display for files with kanban syntax
		if (card.type === 'markdown' && card.hasKanbanSyntax && card.kanbanLists) {
			this.renderMiniKanban(cardEl, card);
		}

		// Image thumbnail (if enabled in settings)
		this.renderImageThumbnail(cardEl, card);

		// Card click handler - on header for image cards, on whole card for others
		if (card.type === 'image') {
			// For images, only header triggers the action (thumbnail has its own handler)
			headerEl.onclick = async (e) => {
				e.preventDefault();
				await this.callbacks.onCardClick(card, cardEl);
			};
		} else {
			// For other card types, whole card is clickable
			cardEl.onclick = async (e) => {
				e.preventDefault();
				await this.callbacks.onCardClick(card, cardEl);
			};
		}

		// Double-click to open in new tab (for files)
		if (card.type !== 'folder') {
			cardEl.ondblclick = async (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (card.file) {
					await this.app.workspace.getLeaf('tab').openFile(card.file);
				}
			};
		}
	}

	/**
	 * Render card tags
	 */
	private renderCardTags(cardEl: HTMLElement, card: KanbanCard): void {
		const showTags = this.plugin.settings?.showTags ?? true;
		const maxTags = this.plugin.settings?.maxTagsShown ?? 5;
		
		if (showTags && card.tags && card.tags.length > 0) {
			const tagsEl = cardEl.createEl('div', { cls: 'kanban-card-tags' });
			for (const tag of card.tags.slice(0, maxTags)) {
				const tagEl = tagsEl.createEl('span', { 
					cls: 'kanban-card-tag',
					text: `#${tag}`
				});
				// Add click handler to filter by tag
				tagEl.onclick = async (e) => {
					e.stopPropagation();
					await this.callbacks.onTagClick(tag);
				};
			}
			if (card.tags.length > maxTags) {
				tagsEl.createEl('span', { 
					cls: 'kanban-card-tag kanban-card-tag-more',
					text: `+${card.tags.length - maxTags}`
				});
			}
		}
	}

	/**
	 * Render card preview text
	 */
	private renderCardPreview(cardEl: HTMLElement, card: KanbanCard): void {
		const showPreview = this.plugin.settings?.showPreviewText ?? true;
		if (showPreview && card.type === 'markdown' && card.preview) {
			cardEl.createEl('div', { 
				cls: 'kanban-card-preview',
				text: card.preview
			});
		}
	}

	/**
	 * Render image thumbnail with preview option
	 */
	private renderImageThumbnail(cardEl: HTMLElement, card: KanbanCard): void {
		const showThumbnails = this.plugin.settings?.showImageThumbnails ?? true;
		if (showThumbnails && card.type === 'image' && card.file) {
			const thumbnailEl = cardEl.createEl('div', { cls: 'kanban-card-thumbnail' });
			
			thumbnailEl.createEl('img', {
				attr: { 
					src: this.app.vault.getResourcePath(card.file),
					alt: card.title
				}
			});
			
			// Preview overlay button
			const previewOverlay = thumbnailEl.createEl('div', { cls: 'kanban-card-thumbnail-overlay' });
			const previewBtn = previewOverlay.createEl('button', { 
				cls: 'kanban-card-preview-btn',
				attr: { 'aria-label': 'Preview image' }
			});
			previewBtn.innerHTML = Icons.expand;
			
			// Click on thumbnail or button opens preview
			thumbnailEl.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.callbacks.onImagePreview(card);
			};
		}
	}

	/**
	 * Render mini kanban board for files with kanban syntax
	 */
	private renderMiniKanban(cardEl: HTMLElement, card: KanbanCard): void {
		if (!card.kanbanLists) return;
		
		const miniBoard = cardEl.createEl('div', { cls: 'kanban-mini-board' });
		
		for (const list of card.kanbanLists.slice(0, 3)) { // Show max 3 lists
			const listEl = miniBoard.createEl('div', { cls: 'kanban-mini-list' });
			
			listEl.createEl('div', { 
				cls: 'kanban-mini-list-title',
				text: list.title
			});
			
			const itemsEl = listEl.createEl('div', { cls: 'kanban-mini-items' });
			
			// Show completed count
			const completed = list.items.filter(i => i.completed).length;
			const total = list.items.length;
			
			itemsEl.createEl('span', { 
				cls: 'kanban-mini-count',
				text: `${completed}/${total}`
			});
			
			// Progress bar
			const progressBar = itemsEl.createEl('div', { cls: 'kanban-mini-progress' });
			const progressFill = progressBar.createEl('div', { 
				cls: 'kanban-mini-progress-fill'
			});
			progressFill.style.width = total > 0 ? `${(completed / total) * 100}%` : '0%';
		}
		
		if (card.kanbanLists.length > 3) {
			miniBoard.createEl('div', { 
				cls: 'kanban-mini-more',
				text: `+${card.kanbanLists.length - 3} more`
			});
		}
	}
}

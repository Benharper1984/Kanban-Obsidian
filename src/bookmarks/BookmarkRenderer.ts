import { App, Menu, Notice, TFile, TFolder } from 'obsidian';
import { BookmarkList, BookmarkCard, BookmarkBoardState, BookmarkSortOption } from './types';
import { Icons } from '../components';
import Kanban4000Plugin from '../main';
import { BookmarkBuilder } from './BookmarkBuilder';

export interface BookmarkRendererCallbacks {
	onCardClick: (card: BookmarkCard) => Promise<void>;
	onGroupClick: (groupTitle: string) => Promise<void>;
	onRemoveBookmark: (card: BookmarkCard) => Promise<void>;
	onRender: () => Promise<void>;
}

/**
 * BookmarkRenderer handles rendering the bookmark kanban board
 */
export class BookmarkRenderer {
	constructor(
		private app: App,
		private plugin: Kanban4000Plugin,
		private callbacks: BookmarkRendererCallbacks
	) {}

	/**
	 * Render the bookmark board with all lists
	 */
	renderBoard(container: HTMLElement, lists: BookmarkList[], searchQuery: string): void {
		const board = container.createEl('div', { cls: 'kanban-board bookmark-board' });

		if (lists.length === 0 && searchQuery) {
			board.createEl('div', {
				cls: 'kanban-empty',
				text: 'No bookmarks match your search'
			});
			return;
		}

		if (lists.length === 0) {
			board.createEl('div', {
				cls: 'kanban-empty',
				text: 'No bookmarks found. Add bookmarks using Obsidian\'s bookmark feature.'
			});
			return;
		}

		for (const list of lists) {
			this.renderList(board, list);
		}
	}

	/**
	 * Render a single list (column)
	 */
	private renderList(board: HTMLElement, list: BookmarkList): void {
		const listEl = board.createEl('div', {
			cls: `kanban-list bookmark-list ${list.type === 'group' ? 'bookmark-group-list' : 'bookmark-ungrouped-list'}`
		});

		// List header
		const headerEl = listEl.createEl('div', { cls: 'kanban-list-header' });

		// Group icon
		const iconEl = headerEl.createEl('span', { cls: 'bookmark-list-icon' });
		iconEl.innerHTML = list.type === 'group' ? BookmarkIcons.group : BookmarkIcons.bookmark;

		headerEl.createEl('span', {
			cls: 'kanban-list-title',
			text: list.title
		});
		headerEl.createEl('span', {
			cls: 'kanban-list-count',
			text: `${list.items.length}`
		});

		// Cards container
		const cardsEl = listEl.createEl('div', { cls: 'kanban-cards bookmark-cards' });

		for (const card of list.items) {
			this.renderCard(cardsEl, card);
		}
	}

	/**
	 * Render a single bookmark card
	 */
	private renderCard(container: HTMLElement, card: BookmarkCard): void {
		const cardEl = container.createEl('div', {
			cls: `kanban-card bookmark-card bookmark-card-${card.type}`,
			attr: { 'data-path': card.path || '' }
		});

		// Context menu
		cardEl.oncontextmenu = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e, card);
		};

		// Card header
		const headerEl = cardEl.createEl('div', { cls: 'kanban-card-header' });

		// Card icon
		const iconEl = headerEl.createEl('span', { cls: 'kanban-card-icon bookmark-card-icon' });
		iconEl.innerHTML = this.getCardIcon(card);

		// Card title
		headerEl.createEl('span', {
			cls: 'kanban-card-title',
			text: card.title
		});

		// Type badge for non-file items
		if (card.type !== 'file' && card.type !== 'folder') {
			const typeBadge = headerEl.createEl('span', {
				cls: 'bookmark-type-badge',
				text: card.type
			});
		}

		// Path subtitle for files/folders
		if (card.path && (card.type === 'file' || card.type === 'folder')) {
			const pathEl = cardEl.createEl('div', { cls: 'bookmark-card-path' });
			pathEl.setText(card.path);
		}

		// Search query for search bookmarks
		if (card.type === 'search' && card.query) {
			const queryEl = cardEl.createEl('div', { cls: 'bookmark-card-query' });
			queryEl.createEl('span', { cls: 'bookmark-query-label', text: 'Query: ' });
			queryEl.createEl('span', { cls: 'bookmark-query-text', text: card.query });
		}

		// Item count for groups
		if (card.type === 'group' && card.itemCount !== undefined) {
			const countEl = cardEl.createEl('div', { cls: 'bookmark-card-count' });
			countEl.setText(`${card.itemCount} item${card.itemCount !== 1 ? 's' : ''}`);
		}

		// Preview text for markdown files
		if (card.preview && this.plugin.settings?.showPreviewText) {
			const previewEl = cardEl.createEl('div', { cls: 'kanban-card-preview bookmark-card-preview' });
			previewEl.setText(card.preview);
		}

		// Tags
		if (card.tags && card.tags.length > 0 && this.plugin.settings?.showTags) {
			this.renderCardTags(cardEl, card);
		}

		// Click handler
		headerEl.onclick = async (e) => {
			e.preventDefault();
			if (card.type === 'group') {
				await this.callbacks.onGroupClick(card.title);
			} else {
				await this.callbacks.onCardClick(card);
			}
		};
	}

	/**
	 * Render card tags
	 */
	private renderCardTags(cardEl: HTMLElement, card: BookmarkCard): void {
		const maxTags = this.plugin.settings?.maxTagsShown ?? 5;
		const tags = card.tags || [];

		if (tags.length === 0) return;

		const tagsContainer = cardEl.createEl('div', { cls: 'kanban-card-tags' });

		const displayTags = tags.slice(0, maxTags);
		for (const tag of displayTags) {
			const tagEl = tagsContainer.createEl('span', {
				cls: 'kanban-card-tag',
				text: tag
			});
		}

		if (tags.length > maxTags) {
			tagsContainer.createEl('span', {
				cls: 'kanban-card-tag kanban-card-tag-more',
				text: `+${tags.length - maxTags}`
			});
		}
	}

	/**
	 * Get the appropriate icon for a bookmark card
	 */
	private getCardIcon(card: BookmarkCard): string {
		switch (card.type) {
			case 'file':
				if (card.file?.extension === 'md') {
					return Icons.markdown;
				}
				return Icons.attachment;
			case 'folder':
				return Icons.folder;
			case 'group':
				return BookmarkIcons.group;
			case 'search':
				return BookmarkIcons.search;
			case 'graph':
				return BookmarkIcons.graph;
			default:
				return BookmarkIcons.bookmark;
		}
	}

	/**
	 * Show context menu for a bookmark card
	 */
	private showContextMenu(event: MouseEvent, card: BookmarkCard): void {
		const menu = new Menu();

		// Open in new tab (for files)
		if (card.type === 'file' && card.file) {
			menu.addItem(item => {
				item.setTitle('Open in new tab')
					.setIcon('file-plus')
					.onClick(async () => {
						await this.app.workspace.getLeaf('tab').openFile(card.file!);
					});
			});

			menu.addItem(item => {
				item.setTitle('Open in new pane')
					.setIcon('separator-vertical')
					.onClick(async () => {
						await this.app.workspace.getLeaf('split', 'vertical').openFile(card.file!);
					});
			});

			menu.addSeparator();
		}

		// Open folder in file explorer (for folders)
		if (card.type === 'folder' && card.folder) {
			menu.addItem(item => {
				item.setTitle('Reveal in navigation')
					.setIcon('folder')
					.onClick(() => {
						// @ts-ignore
						this.app.internalPlugins.getPluginById('file-explorer')?.instance?.revealInFolder(card.folder);
					});
			});

			menu.addSeparator();
		}

		// Execute search (for search bookmarks)
		if (card.type === 'search' && card.query) {
			menu.addItem(item => {
				item.setTitle('Execute search')
					.setIcon('search')
					.onClick(() => {
						// @ts-ignore
						this.app.internalPlugins.getPluginById('global-search')?.instance?.openGlobalSearch(card.query);
					});
			});

			menu.addSeparator();
		}

		// Open graph (for graph bookmarks)
		if (card.type === 'graph') {
			menu.addItem(item => {
				item.setTitle('Open graph view')
					.setIcon('git-fork')
					.onClick(async () => {
						// @ts-ignore
						await this.app.commands.executeCommandById('graph:open');
					});
			});

			menu.addSeparator();
		}

		// Copy path
		if (card.path) {
			menu.addItem(item => {
				item.setTitle('Copy path')
					.setIcon('copy')
					.onClick(() => {
						navigator.clipboard.writeText(card.path!);
						new Notice('Path copied to clipboard');
					});
			});
		}

		// Remove bookmark
		menu.addItem(item => {
			item.setTitle('Remove bookmark')
				.setIcon('trash')
				.onClick(async () => {
					await this.callbacks.onRemoveBookmark(card);
				});
		});

		menu.showAtMouseEvent(event);
	}
}

/**
 * Bookmark-specific icons
 */
export const BookmarkIcons = {
	bookmark: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
	
	bookmarkFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
	
	group: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`,
	
	search: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
	
	graph: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="6" y1="9" x2="6" y2="15"></line><line x1="18" y1="9" x2="18" y2="15"></line><line x1="9" y1="6" x2="15" y2="6"></line></svg>`,
	
	star: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
};

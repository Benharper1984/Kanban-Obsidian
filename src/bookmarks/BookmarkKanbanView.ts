import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import Kanban4000Plugin from '../main';
import { BookmarkBoardState, BookmarkSortOption, BookmarkCard, BookmarkList } from './types';
import { BookmarkBuilder } from './BookmarkBuilder';
import { BookmarkRenderer, BookmarkIcons } from './BookmarkRenderer';
import { Icons } from '../components';

export const VIEW_TYPE_BOOKMARK_KANBAN = 'bookmark-kanban-view';

/**
 * BookmarkKanbanView displays Obsidian bookmarks in a kanban-style board
 */
export class BookmarkKanbanView extends ItemView {
	plugin: Kanban4000Plugin;
	state: BookmarkBoardState;
	contentEl: HTMLElement;

	private keyHandler: (e: KeyboardEvent) => void;
	private bookmarkBuilder: BookmarkBuilder;
	private bookmarkRenderer: BookmarkRenderer;

	constructor(leaf: WorkspaceLeaf, plugin: Kanban4000Plugin) {
		super(leaf);
		this.plugin = plugin;

		// Initialize state
		this.state = {
			searchQuery: '',
			sortBy: 'name',
			sortDirection: 'asc',
			currentGroup: null,
			history: []
		};

		// Setup keyboard handler
		this.keyHandler = this.handleKeydown.bind(this);

		// Initialize bookmark builder
		this.bookmarkBuilder = new BookmarkBuilder(this.app);

		// Initialize bookmark renderer
		this.bookmarkRenderer = new BookmarkRenderer(this.app, plugin, {
			onCardClick: async (card) => this.handleCardClick(card),
			onGroupClick: async (groupTitle) => this.navigateToGroup(groupTitle),
			onRemoveBookmark: async (card) => this.removeBookmark(card),
			onRender: async () => this.render()
		});
	}

	getViewType(): string {
		return VIEW_TYPE_BOOKMARK_KANBAN;
	}

	getDisplayText(): string {
		if (this.state.currentGroup) {
			return `Bookmarks: ${this.state.currentGroup}`;
		}
		return 'Bookmarks Kanban';
	}

	getIcon(): string {
		return 'bookmark';
	}

	async onOpen() {
		this.contentEl = this.containerEl.children[1] as HTMLElement;
		this.contentEl.empty();
		this.contentEl.addClass('kanban-4000-container', 'bookmark-kanban-container');

		if (this.plugin.settings?.enableAnimations) {
			this.contentEl.addClass('kanban-animations-enabled');
		}

		this.containerEl.addEventListener('keydown', this.keyHandler);
		await this.render();
	}

	async onClose() {
		this.containerEl.removeEventListener('keydown', this.keyHandler);
	}

	/**
	 * Handle keyboard shortcuts
	 */
	private handleKeydown(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			if (e.key === 'Escape') {
				(e.target as HTMLElement).blur();
				e.preventDefault();
			}
			return;
		}

		switch (e.key) {
			case 'Backspace':
			case 'ArrowLeft':
				if (this.state.currentGroup) {
					this.navigateBack();
					e.preventDefault();
				}
				break;
			case 'Escape':
				if (this.state.searchQuery) {
					this.state.searchQuery = '';
					this.render();
					e.preventDefault();
				}
				break;
			case '/':
				// Focus search
				const searchInput = this.contentEl.querySelector('.bookmark-search-input') as HTMLInputElement;
				if (searchInput) {
					searchInput.focus();
					e.preventDefault();
				}
				break;
			case 'r':
			case 'R':
				this.render();
				e.preventDefault();
				break;
			case 'Home':
				if (this.state.currentGroup) {
					this.state.currentGroup = null;
					this.state.history = [];
					this.render();
					e.preventDefault();
				}
				break;
		}
	}

	/**
	 * Navigate to a bookmark group
	 */
	async navigateToGroup(groupTitle: string) {
		if (this.state.currentGroup) {
			this.state.history.push(this.state.currentGroup);
		}
		this.state.currentGroup = this.state.currentGroup 
			? `${this.state.currentGroup}/${groupTitle}` 
			: groupTitle;
		await this.render();
	}

	/**
	 * Navigate back to parent group
	 */
	async navigateBack() {
		if (this.state.history.length > 0) {
			this.state.currentGroup = this.state.history.pop() || null;
		} else {
			this.state.currentGroup = null;
		}
		await this.render();
	}

	/**
	 * Handle clicking on a bookmark card
	 */
	async handleCardClick(card: BookmarkCard) {
		switch (card.type) {
			case 'file':
				if (card.file) {
					await this.app.workspace.getLeaf().openFile(card.file);
				}
				break;
			case 'folder':
				if (card.folder) {
					// Navigate in file explorer
					// @ts-ignore
					this.app.internalPlugins.getPluginById('file-explorer')?.instance?.revealInFolder(card.folder);
				}
				break;
			case 'search':
				if (card.query) {
					// @ts-ignore
					this.app.internalPlugins.getPluginById('global-search')?.instance?.openGlobalSearch(card.query);
				}
				break;
			case 'graph':
				// @ts-ignore
				await this.app.commands.executeCommandById('graph:open');
				break;
			case 'group':
				await this.navigateToGroup(card.title);
				break;
		}
	}

	/**
	 * Remove a bookmark
	 */
	async removeBookmark(card: BookmarkCard) {
		const success = await this.bookmarkBuilder.removeBookmark(card.originalItem);
		if (success) {
			new Notice(`Removed bookmark: ${card.title}`);
			await this.render();
		} else {
			new Notice('Failed to remove bookmark');
		}
	}

	/**
	 * Render the bookmark kanban view
	 */
	async render() {
		this.contentEl.empty();

		// Check if bookmarks plugin is enabled
		if (!this.bookmarkBuilder.isBookmarksEnabled()) {
			this.renderBookmarksDisabled();
			return;
		}

		// Render toolbar
		this.renderToolbar();

		// Build and render the board
		const lists = await this.bookmarkBuilder.buildBoard(this.state.currentGroup);
		const processedLists = this.bookmarkBuilder.processLists(lists, this.state);

		// Render the board
		this.bookmarkRenderer.renderBoard(this.contentEl, processedLists, this.state.searchQuery);

		// Update leaf title - use internal API since updateHeader is not in public API
		// @ts-ignore - Internal Obsidian API
		if (this.leaf.updateHeader) {
			// @ts-ignore
			this.leaf.updateHeader();
		}
	}

	/**
	 * Render message when bookmarks plugin is disabled
	 */
	private renderBookmarksDisabled() {
		const messageEl = this.contentEl.createEl('div', { cls: 'bookmark-disabled-message' });
		
		const iconEl = messageEl.createEl('div', { cls: 'bookmark-disabled-icon' });
		iconEl.innerHTML = BookmarkIcons.bookmark;
		
		messageEl.createEl('h3', { text: 'Bookmarks Plugin Disabled' });
		messageEl.createEl('p', { 
			text: 'Enable the core Bookmarks plugin in Settings → Core plugins to use this feature.' 
		});
		
		const settingsBtn = messageEl.createEl('button', { 
			cls: 'bookmark-settings-btn',
			text: 'Open Settings'
		});
		settingsBtn.onclick = () => {
			// @ts-ignore
			this.app.setting.open();
			// @ts-ignore
			this.app.setting.openTabById('core-plugins');
		};
	}

	/**
	 * Render the toolbar with search, sort, and navigation
	 */
	private renderToolbar() {
		const toolbar = this.contentEl.createEl('div', { cls: 'kanban-toolbar bookmark-toolbar' });

		// Left section - Back button and breadcrumbs
		const leftSection = toolbar.createEl('div', { cls: 'bookmark-toolbar-left' });

		// Back button (only show when in a group)
		if (this.state.currentGroup) {
			const backBtn = leftSection.createEl('button', {
				cls: 'kanban-back-btn',
				attr: { 'aria-label': 'Go back' }
			});
			backBtn.innerHTML = Icons.back;
			backBtn.onclick = () => this.navigateBack();
		}

		// Breadcrumbs
		this.renderBreadcrumbs(leftSection);

		// Center section - Search
		const centerSection = toolbar.createEl('div', { cls: 'bookmark-toolbar-center' });
		this.renderSearch(centerSection);

		// Right section - Sort controls
		const rightSection = toolbar.createEl('div', { cls: 'bookmark-toolbar-right' });
		this.renderSortControls(rightSection);
	}

	/**
	 * Render breadcrumb navigation
	 */
	private renderBreadcrumbs(container: HTMLElement) {
		const breadcrumbs = container.createEl('div', { cls: 'kanban-breadcrumbs bookmark-breadcrumbs' });

		// Root
		const rootCrumb = breadcrumbs.createEl('span', {
			cls: 'kanban-breadcrumb bookmark-breadcrumb',
			text: 'Bookmarks'
		});
		if (this.state.currentGroup) {
			rootCrumb.addClass('clickable');
			rootCrumb.onclick = () => {
				this.state.currentGroup = null;
				this.state.history = [];
				this.render();
			};
		}

		// Group path
		if (this.state.currentGroup) {
			const parts = this.state.currentGroup.split('/');
			parts.forEach((part, index) => {
				breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb-separator', text: ' / ' });
				
				const crumb = breadcrumbs.createEl('span', {
					cls: 'kanban-breadcrumb bookmark-breadcrumb',
					text: part
				});

				// Make all but last crumb clickable
				if (index < parts.length - 1) {
					crumb.addClass('clickable');
					crumb.onclick = () => {
						this.state.currentGroup = parts.slice(0, index + 1).join('/');
						this.state.history = [];
						this.render();
					};
				}
			});
		}
	}

	/**
	 * Render search input
	 */
	private renderSearch(container: HTMLElement) {
		const searchWrapper = container.createEl('div', { cls: 'kanban-search-wrapper bookmark-search-wrapper' });

		const searchIcon = searchWrapper.createEl('span', { cls: 'kanban-search-icon' });
		searchIcon.innerHTML = Icons.search;

		const searchInput = searchWrapper.createEl('input', {
			cls: 'kanban-search-input bookmark-search-input',
			attr: {
				type: 'text',
				placeholder: 'Search bookmarks...',
				value: this.state.searchQuery
			}
		}) as HTMLInputElement;

		searchInput.oninput = async () => {
			this.state.searchQuery = searchInput.value;
			await this.render();
		};

		// Clear button
		if (this.state.searchQuery) {
			const clearBtn = searchWrapper.createEl('button', {
				cls: 'kanban-search-clear',
				attr: { 'aria-label': 'Clear search' }
			});
			clearBtn.innerHTML = Icons.close;
			clearBtn.onclick = async () => {
				this.state.searchQuery = '';
				await this.render();
			};
		}
	}

	/**
	 * Render sort controls
	 */
	private renderSortControls(container: HTMLElement) {
		const sortWrapper = container.createEl('div', { cls: 'kanban-sort-wrapper bookmark-sort-wrapper' });

		// Sort by dropdown
		const sortSelect = sortWrapper.createEl('select', {
			cls: 'kanban-sort-select bookmark-sort-select'
		}) as HTMLSelectElement;

		const sortOptions: { value: BookmarkSortOption; label: string }[] = [
			{ value: 'name', label: 'Name' },
			{ value: 'created', label: 'Bookmark Created' },
			{ value: 'type', label: 'Type' }
		];

		for (const option of sortOptions) {
			const optEl = sortSelect.createEl('option', {
				text: option.label,
				attr: { value: option.value }
			});
			if (option.value === this.state.sortBy) {
				optEl.selected = true;
			}
		}

		sortSelect.onchange = async () => {
			this.state.sortBy = sortSelect.value as BookmarkSortOption;
			await this.render();
		};

		// Sort direction toggle
		const directionBtn = sortWrapper.createEl('button', {
			cls: 'kanban-sort-direction bookmark-sort-direction',
			attr: { 'aria-label': `Sort ${this.state.sortDirection === 'asc' ? 'ascending' : 'descending'}` }
		});
		directionBtn.innerHTML = this.state.sortDirection === 'asc' ? Icons.chevronUp : Icons.chevronDown;
		directionBtn.onclick = async () => {
			this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
			await this.render();
		};

		// Refresh button
		const refreshBtn = sortWrapper.createEl('button', {
			cls: 'bookmark-refresh-btn',
			attr: { 'aria-label': 'Refresh bookmarks' }
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
		refreshBtn.onclick = () => this.render();
	}
}

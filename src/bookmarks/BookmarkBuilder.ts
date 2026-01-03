import { App, TFile, TFolder } from 'obsidian';
import { 
	ObsidianBookmarkItem, 
	BookmarkList, 
	BookmarkCard, 
	BookmarkBoardState,
	BookmarkSortOption,
	BookmarkCardType
} from './types';
import { extractTags } from '../types';

/**
 * BookmarkBuilder handles fetching bookmarks from Obsidian's internal bookmarks plugin
 * and building the kanban board data structure.
 */
export class BookmarkBuilder {
	constructor(private app: App) {}

	/**
	 * Get the bookmarks plugin instance
	 */
	private getBookmarksPlugin(): any {
		// Access Obsidian's internal bookmarks plugin
		// @ts-ignore - Accessing internal API
		return this.app.internalPlugins?.getPluginById?.('bookmarks');
	}

	/**
	 * Check if bookmarks plugin is enabled
	 */
	isBookmarksEnabled(): boolean {
		const plugin = this.getBookmarksPlugin();
		return plugin?.enabled ?? false;
	}

	/**
	 * Get all bookmarks from Obsidian
	 */
	getBookmarks(): ObsidianBookmarkItem[] {
		const plugin = this.getBookmarksPlugin();
		if (!plugin?.enabled) {
			return [];
		}
		// @ts-ignore - Accessing internal API
		return plugin.instance?.items ?? [];
	}

	/**
	 * Build the bookmark board structure
	 * Groups become columns, ungrouped items go in a "Bookmarks" column
	 */
	async buildBoard(groupPath: string | null = null): Promise<BookmarkList[]> {
		const bookmarks = this.getBookmarks();
		const lists: BookmarkList[] = [];

		if (groupPath) {
			// Navigate to a specific group
			const group = this.findGroup(bookmarks, groupPath);
			if (group && group.items) {
				return this.buildListsFromItems(group.items);
			}
			return [];
		}

		return this.buildListsFromItems(bookmarks);
	}

	/**
	 * Build lists from a set of bookmark items
	 */
	private async buildListsFromItems(items: ObsidianBookmarkItem[]): Promise<BookmarkList[]> {
		const lists: BookmarkList[] = [];
		const ungroupedItems: BookmarkCard[] = [];

		for (const item of items) {
			if (item.type === 'group') {
				// Groups become their own columns
				const groupCards = await this.buildCardsFromItems(item.items || []);
				lists.push({
					title: item.title || 'Untitled Group',
					type: 'group',
					items: groupCards
				});
			} else {
				// Non-group items go in ungrouped
				const card = await this.itemToCard(item);
				if (card) {
					ungroupedItems.push(card);
				}
			}
		}

		// Add ungrouped items as the first column if any exist
		if (ungroupedItems.length > 0) {
			lists.unshift({
				title: 'Bookmarks',
				type: 'ungrouped',
				items: ungroupedItems
			});
		}

		return lists;
	}

	/**
	 * Build cards from a list of bookmark items (non-recursive for display)
	 */
	private async buildCardsFromItems(items: ObsidianBookmarkItem[]): Promise<BookmarkCard[]> {
		const cards: BookmarkCard[] = [];
		
		for (const item of items) {
			const card = await this.itemToCard(item);
			if (card) {
				cards.push(card);
			}
		}

		return cards;
	}

	/**
	 * Find a group by its path (nested groups use "/" separator)
	 */
	private findGroup(items: ObsidianBookmarkItem[], path: string): ObsidianBookmarkItem | null {
		const parts = path.split('/');
		let current: ObsidianBookmarkItem[] = items;

		for (const part of parts) {
			const found = current.find(item => item.type === 'group' && item.title === part);
			if (!found) return null;
			if (found.type === 'group') {
				current = found.items || [];
				if (parts.indexOf(part) === parts.length - 1) {
					return found;
				}
			}
		}

		return null;
	}

	/**
	 * Convert a bookmark item to a card
	 */
	async itemToCard(item: ObsidianBookmarkItem): Promise<BookmarkCard | null> {
		const baseCard: BookmarkCard = {
			title: item.title || this.getTitleFromPath(item.path) || 'Untitled',
			path: item.path,
			type: item.type as BookmarkCardType,
			bookmarkCreated: item.ctime,
			originalItem: item
		};

		switch (item.type) {
			case 'file':
				if (item.path) {
					const file = this.app.vault.getAbstractFileByPath(item.path);
					if (file instanceof TFile) {
						baseCard.file = file;
						baseCard.title = file.basename;
						
						// Get preview and tags for markdown files
						if (file.extension === 'md') {
							try {
								const content = await this.app.vault.cachedRead(file);
								baseCard.tags = extractTags(content);
								
								// Get preview text
								const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');
								const cleanContent = withoutFrontmatter.trim();
								baseCard.preview = cleanContent.substring(0, 100) + 
									(cleanContent.length > 100 ? '...' : '');
							} catch (e) {
								// File might not be readable
							}
						}
					}
				}
				break;

			case 'folder':
				if (item.path) {
					const folder = this.app.vault.getAbstractFileByPath(item.path);
					if (folder instanceof TFolder) {
						baseCard.folder = folder;
						baseCard.title = folder.name;
					}
				}
				break;

			case 'group':
				baseCard.itemCount = (item.items || []).length;
				break;

			case 'search':
				baseCard.query = item.query;
				baseCard.title = item.title || `Search: ${item.query}`;
				break;

			case 'graph':
				baseCard.title = item.title || 'Graph View';
				break;

			default:
				baseCard.type = 'unknown';
		}

		return baseCard;
	}

	/**
	 * Get title from file path
	 */
	private getTitleFromPath(path?: string): string | undefined {
		if (!path) return undefined;
		const parts = path.split('/');
		const filename = parts[parts.length - 1];
		// Remove extension for display
		return filename.replace(/\.[^/.]+$/, '');
	}

	/**
	 * Sort cards based on sort settings
	 */
	sortCards(cards: BookmarkCard[], sortBy: BookmarkSortOption, sortDirection: 'asc' | 'desc'): BookmarkCard[] {
		const sorted = [...cards].sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'name':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'created':
					comparison = b.bookmarkCreated - a.bookmarkCreated;
					break;
				case 'type':
					comparison = a.type.localeCompare(b.type);
					break;
			}

			return sortDirection === 'asc' ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Filter cards based on search query
	 */
	filterCards(cards: BookmarkCard[], searchQuery: string): BookmarkCard[] {
		if (!searchQuery.trim()) {
			return cards;
		}

		const query = searchQuery.toLowerCase();

		return cards.filter(card => {
			// Search in title
			if (card.title.toLowerCase().includes(query)) return true;
			
			// Search in path
			if (card.path?.toLowerCase().includes(query)) return true;
			
			// Search in preview
			if (card.preview?.toLowerCase().includes(query)) return true;
			
			// Search in tags
			if (card.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
			
			// Search in query (for search bookmarks)
			if (card.query?.toLowerCase().includes(query)) return true;

			return false;
		});
	}

	/**
	 * Apply both filtering and sorting to cards
	 */
	processCards(cards: BookmarkCard[], state: BookmarkBoardState): BookmarkCard[] {
		const filtered = this.filterCards(cards, state.searchQuery);
		return this.sortCards(filtered, state.sortBy, state.sortDirection);
	}

	/**
	 * Process all lists - filter and sort cards in each list
	 */
	processLists(lists: BookmarkList[], state: BookmarkBoardState): BookmarkList[] {
		return lists.map(list => ({
			...list,
			items: this.processCards(list.items, state)
		})).filter(list => list.items.length > 0 || state.searchQuery === '');
	}

	/**
	 * Add a new bookmark
	 */
	async addBookmark(path: string, title?: string): Promise<boolean> {
		const plugin = this.getBookmarksPlugin();
		if (!plugin?.enabled || !plugin.instance) {
			return false;
		}

		try {
			// @ts-ignore - Accessing internal API
			await plugin.instance.addItem({
				type: 'file',
				path: path,
				title: title,
				ctime: Date.now()
			});
			return true;
		} catch (e) {
			console.error('Failed to add bookmark:', e);
			return false;
		}
	}

	/**
	 * Remove a bookmark
	 */
	async removeBookmark(item: ObsidianBookmarkItem): Promise<boolean> {
		const plugin = this.getBookmarksPlugin();
		if (!plugin?.enabled || !plugin.instance) {
			return false;
		}

		try {
			// @ts-ignore - Accessing internal API
			await plugin.instance.removeItem(item);
			return true;
		} catch (e) {
			console.error('Failed to remove bookmark:', e);
			return false;
		}
	}
}

import { App, Notice } from 'obsidian';

/**
 * Simple interface for Obsidian bookmark items
 */
export interface BookmarkItem {
	type: 'file' | 'folder' | 'group' | 'search' | 'graph';
	path?: string;
	title?: string;
	items?: BookmarkItem[];
}

/**
 * BookmarkService provides access to Obsidian's internal bookmarks plugin.
 * Used by CoreBoardBuilder to filter items by bookmark status.
 */
export class BookmarkService {
	constructor(private app: App) {}

	/**
	 * Get the bookmarks plugin instance
	 */
	private getBookmarksPlugin(): any {
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
	getBookmarks(): BookmarkItem[] {
		const plugin = this.getBookmarksPlugin();
		if (!plugin?.enabled) {
			return [];
		}
		// @ts-ignore - Accessing internal API
		return plugin.instance?.items ?? [];
	}

	/**
	 * Get all bookmarked file/folder paths (flattened from groups)
	 */
	getBookmarkedPaths(): Set<string> {
		const paths = new Set<string>();
		const bookmarks = this.getBookmarks();
		this.collectPaths(bookmarks, paths);
		return paths;
	}

	/**
	 * Recursively collect paths from bookmark items
	 */
	private collectPaths(items: BookmarkItem[], paths: Set<string>): void {
		for (const item of items) {
			if (item.path) {
				paths.add(item.path);
			}
			if (item.type === 'group' && item.items) {
				this.collectPaths(item.items, paths);
			}
		}
	}

	/**
	 * Check if a path is bookmarked
	 */
	isBookmarked(path: string): boolean {
		return this.getBookmarkedPaths().has(path);
	}

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
				// @ts-ignore - Accessing internal API
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
}

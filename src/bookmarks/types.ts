import { TFile, TFolder } from 'obsidian';

/**
 * Represents an Obsidian bookmark item from the internal bookmarks plugin
 */
export interface ObsidianBookmarkItem {
	type: 'file' | 'folder' | 'group' | 'search' | 'graph';
	ctime: number;
	path?: string;
	title?: string;
	query?: string;
	items?: ObsidianBookmarkItem[];
}

/**
 * State for the bookmark kanban view
 */
export interface BookmarkBoardState {
	searchQuery: string;
	sortBy: BookmarkSortOption;
	sortDirection: 'asc' | 'desc';
	currentGroup: string | null; // null = root level
	history: string[];
}

export type BookmarkSortOption = 'name' | 'created' | 'type';

/**
 * A list/column in the bookmark kanban view
 */
export interface BookmarkList {
	title: string;
	type: 'group' | 'ungrouped';
	items: BookmarkCard[];
}

/**
 * A card representing a bookmark in the kanban view
 */
export interface BookmarkCard {
	title: string;
	path?: string;
	type: BookmarkCardType;
	file?: TFile;
	folder?: TFolder;
	preview?: string;
	tags?: string[];
	bookmarkCreated: number;
	// For groups
	itemCount?: number;
	// For search bookmarks
	query?: string;
	// Original bookmark item for reference
	originalItem: ObsidianBookmarkItem;
}

export type BookmarkCardType = 'file' | 'folder' | 'group' | 'search' | 'graph' | 'unknown';

/**
 * Get the display type name for a bookmark
 */
export function getBookmarkTypeName(type: BookmarkCardType): string {
	switch (type) {
		case 'file': return 'File';
		case 'folder': return 'Folder';
		case 'group': return 'Group';
		case 'search': return 'Search';
		case 'graph': return 'Graph';
		default: return 'Unknown';
	}
}

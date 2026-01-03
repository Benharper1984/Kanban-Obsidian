import { TFile, TFolder } from 'obsidian';

export interface BoardState {
	currentPath: string;
	history: string[];
	searchQuery: string;
	sortBy: SortOption;
	sortDirection: 'asc' | 'desc';
	typeFilters: CardType[];  // Which types to show (empty = all)
}

export type SortOption = 'name' | 'modified' | 'created';

// Saved filter presets
export interface SavedFilter {
	id: string;
	name: string;
	icon?: string;
	typeFilters: CardType[];
	searchQuery?: string;
}

export const DEFAULT_SAVED_FILTERS: SavedFilter[] = [
	{ id: 'all', name: 'All', icon: 'layers', typeFilters: [] },
	{ id: 'notes', name: 'Notes', icon: 'file-text', typeFilters: ['markdown'] },
	{ id: 'images', name: 'Images', icon: 'image', typeFilters: ['image'] },
	{ id: 'attachments', name: 'Files', icon: 'paperclip', typeFilters: ['attachment'] },
	{ id: 'folders', name: 'Folders', icon: 'folder', typeFilters: ['folder'] },
];

export interface KanbanList {
	title: string;
	path: string;
	isLooseFiles: boolean;
	cards: KanbanCard[];
}

export interface KanbanCard {
	title: string;
	path: string;
	type: CardType;
	file?: TFile;
	folder?: TFolder;
	preview?: string;
	tags?: string[];
	hasKanbanSyntax?: boolean;
	kanbanLists?: KanbanMdList[];
}

// For kanban syntax in markdown files
export interface KanbanMdList {
	title: string;
	items: KanbanMdItem[];
}

export interface KanbanMdItem {
	text: string;
	completed: boolean;
}

export type CardType = 'folder' | 'markdown' | 'image' | 'attachment';

export function getCardType(extension: string): CardType {
	const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
	const markdownExtensions = ['md'];
	
	if (markdownExtensions.includes(extension.toLowerCase())) {
		return 'markdown';
	}
	if (imageExtensions.includes(extension.toLowerCase())) {
		return 'image';
	}
	return 'attachment';
}

// Parse kanban syntax from markdown content
export function parseKanbanSyntax(content: string): KanbanMdList[] | null {
	const lists: KanbanMdList[] = [];
	const lines = content.split('\n');
	
	let currentList: KanbanMdList | null = null;
	let foundKanbanPattern = false;
	
	for (const line of lines) {
		// Match headers (## Header or ### Header)
		const headerMatch = line.match(/^#{2,3}\s+(.+)$/);
		if (headerMatch) {
			if (currentList && currentList.items.length > 0) {
				lists.push(currentList);
			}
			currentList = {
				title: headerMatch[1].trim(),
				items: []
			};
			continue;
		}
		
		// Match task items (- [ ] or - [x])
		const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
		if (taskMatch && currentList) {
			foundKanbanPattern = true;
			currentList.items.push({
				text: taskMatch[2].trim(),
				completed: taskMatch[1].toLowerCase() === 'x'
			});
		}
	}
	
	// Add last list
	if (currentList && currentList.items.length > 0) {
		lists.push(currentList);
	}
	
	// Only return lists if we found kanban-like patterns (headers with tasks)
	if (foundKanbanPattern && lists.length > 0) {
		return lists;
	}
	
	return null;
}

// Extract tags from content
export function extractTags(content: string): string[] {
	const tagRegex = /#([a-zA-Z0-9_-]+)/g;
	const tags: Set<string> = new Set();
	let match;
	
	while ((match = tagRegex.exec(content)) !== null) {
		// Exclude common markdown patterns like headers
		if (!match[1].match(/^[0-9]+$/)) {
			tags.add(match[1]);
		}
	}
	
	return Array.from(tags);
}

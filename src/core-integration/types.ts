/**
 * Kanban 4000 - Core Integration Types
 * Bridge types between Kanban and Navigator Core
 */

import { TFile, TFolder, WorkspaceLeaf } from 'obsidian';

// ============================================
// Core Type Mirrors (for when core types aren't directly importable)
// These mirror the types from vault-navigator-core
// ============================================

/** Item type from Navigator Core */
export type ItemType = 'file' | 'folder' | 'link';

/** File type from Navigator Core */
export type FileType = 'markdown' | 'image' | 'attachment';

/** Metadata types that can be requested */
export type MetadataType = 'geo' | 'dates' | 'links' | 'tags';

/** VaultItem from Navigator Core */
export interface VaultItem {
	path: string;
	title: string;
	type: ItemType;
	metadata: ItemMetadata;
	file?: TFile;
	folder?: TFolder;
}

/** ItemMetadata from Navigator Core */
export interface ItemMetadata {
	tags: string[];
	links: LinkInfo[];
	backlinks: LinkInfo[];
	created: Date;
	modified: Date;
	geo?: GeoLocation;
	dates?: DateReference[];
	frontmatter: Record<string, unknown>;
	fileType?: FileType;
	preview?: string;
}

/** Link info from Navigator Core */
export interface LinkInfo {
	target: string;
	displayText: string;
	resolved: boolean;
}

/** GeoLocation from Navigator Core */
export interface GeoLocation {
	lat: number;
	lng: number;
	name?: string;
}

/** DateReference from Navigator Core */
export interface DateReference {
	date: Date;
	context: string;
	type: 'created' | 'modified' | 'mentioned' | 'deadline' | 'event';
}

/** ViewState from Navigator Core */
export interface ViewState {
	focusedItem?: string;
	selectedItems: string[];
	filters: FilterState;
	viewSpecific: Record<string, unknown>;
}

/** FilterState from Navigator Core */
export interface FilterState {
	search: string;
	tags: string[];
	dateRange?: { start: Date; end: Date };
	geoRegion?: { bounds: [number, number, number, number] };
	hasLinks?: boolean;
	fileTypes: string[];
}

/** View plugin manifest */
export interface ViewPluginManifest {
	id: string;
	name: string;
	icon: string;
	description: string;
}

/** NavigatorViewPlugin interface */
export interface NavigatorViewPlugin {
	manifest: ViewPluginManifest;
	onRegister(core: NavigatorCore): void;
	onUnregister(): void;
	createView(leaf: WorkspaceLeaf): NavigatorView;
	requiredMetadata(): MetadataType[];
	canDisplayItem(item: VaultItem): boolean;
	getHighlightedItems(): string[];
}

/** NavigatorView interface */
export interface NavigatorView {
	render(items: VaultItem[], state: ViewState): void;
	onItemSelect(path: string): void;
	onFilterChange(filters: FilterState): void;
	getState(): ViewState;
	setState(state: ViewState): void;
	cleanup(): void;
	onSharedStateChange?(state: ViewState): void;
}

/** Navigator Core interface */
export interface NavigatorCore {
	getItems(options?: GetItemsOptions): Promise<VaultItem[]>;
	getItem(path: string): Promise<VaultItem | null>;
	getSharedState(): ViewState;
	updateSharedState(partial: Partial<ViewState>): void;
	updateFilters(filters: Partial<FilterState>): void;
	navigateToItem(path: string, options?: NavigateOptions): Promise<void>;
	on(event: string, callback: Function): () => void;
}

/** Options for getting items */
export interface GetItemsOptions {
	path?: string;
	recursive?: boolean;
	includeMetadata?: MetadataType[];
	filters?: FilterState;
}

/** Options for navigation */
export interface NavigateOptions {
	viewId?: string;
	highlight?: boolean;
	openFile?: boolean;
}

// ============================================
// Kanban-specific Types (local versions)
// ============================================

/** Types that remain specific to Kanban */
export type CardType = 'folder' | 'markdown' | 'image' | 'attachment';
export type SortOption = 'name' | 'modified' | 'created';

/** Saved filter preset */
export interface SavedFilter {
	id: string;
	name: string;
	icon?: string;
	typeFilters: CardType[];
	searchQuery?: string;
}

/** Default saved filters */
export const DEFAULT_SAVED_FILTERS: SavedFilter[] = [
	{ id: 'all', name: 'All', icon: 'layers', typeFilters: [] },
	{ id: 'notes', name: 'Notes', icon: 'file-text', typeFilters: ['markdown'] },
	{ id: 'images', name: 'Images', icon: 'image', typeFilters: ['image'] },
	{ id: 'attachments', name: 'Files', icon: 'paperclip', typeFilters: ['attachment'] },
	{ id: 'folders', name: 'Folders', icon: 'folder', typeFilters: ['folder'] },
];

/** Kanban board state */
export interface BoardState {
	currentPath: string;
	history: string[];
	searchQuery: string;
	sortBy: SortOption;
	sortDirection: 'asc' | 'desc';
	typeFilters: CardType[];
}

/** Kanban list (column) */
export interface KanbanList {
	title: string;
	path: string;
	isLooseFiles: boolean;
	cards: KanbanCard[];
}

/** Kanban card - bridges VaultItem with Kanban-specific properties */
export interface KanbanCard {
	/** Display title */
	title: string;
	
	/** Full path */
	path: string;
	
	/** Card type */
	type: CardType;
	
	/** Obsidian TFile reference */
	file?: TFile;
	
	/** Obsidian TFolder reference */
	folder?: TFolder;
	
	/** Preview text (from VaultItem.metadata.preview) */
	preview?: string;
	
	/** Tags (from VaultItem.metadata.tags) */
	tags?: string[];
	
	/** Whether file contains kanban-style markdown */
	hasKanbanSyntax?: boolean;
	
	/** Parsed kanban lists from markdown */
	kanbanLists?: KanbanMdList[];
	
	/** Whether this card is highlighted (from shared state) */
	isHighlighted?: boolean;
	
	/** Whether this card is selected (from shared state) */
	isSelected?: boolean;
}

/** Kanban list parsed from markdown */
export interface KanbanMdList {
	title: string;
	items: KanbanMdItem[];
}

/** Kanban item parsed from markdown */
export interface KanbanMdItem {
	text: string;
	completed: boolean;
}

// ============================================
// Utility Functions
// ============================================

/** Get card type from file extension */
export function getCardType(extension: string): CardType {
	const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
	const markdownExtensions = ['md'];
	
	const ext = extension.toLowerCase();
	
	if (markdownExtensions.includes(ext)) {
		return 'markdown';
	}
	if (imageExtensions.includes(ext)) {
		return 'image';
	}
	return 'attachment';
}

/** Parse kanban syntax from markdown content */
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
	
	// Only return lists if we found kanban-like patterns
	if (foundKanbanPattern && lists.length > 0) {
		return lists;
	}
	
	return null;
}

/** Extract tags from markdown content (fallback when core not available) */
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

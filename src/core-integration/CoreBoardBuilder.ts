/**
 * Kanban 4000 - Core Board Builder
 * Builds kanban board using Navigator Core's DataProvider
 */

import { App, TFolder, TFile, TAbstractFile } from 'obsidian';
import { VaultItemAdapter } from './VaultItemAdapter';
import { 
	KanbanList, 
	KanbanCard, 
	BoardState, 
	SortOption,
	CardType,
	DateFilter,
	DatePreset,
	getCardType,
	parseKanbanSyntax,
	extractTags
} from '../types';
import { BookmarkService } from '../BookmarkService';

// Type for Navigator Core reference
interface NavigatorCore {
	getItems(options?: { path?: string; recursive?: boolean; includeMetadata?: string[] }): Promise<any[]>;
	getSharedState(): { focusedItem?: string; selectedItems: string[] };
}

/**
 * Builds kanban board data using Navigator Core when available
 */
export class CoreBoardBuilder {
	private adapter: VaultItemAdapter;
	private core: NavigatorCore | null = null;
	private bookmarkService: BookmarkService;
	private bookmarkedPaths: Set<string> = new Set();

	constructor(
		private app: App,
		private excludePatterns: string[]
	) {
		this.adapter = new VaultItemAdapter(app);
		this.bookmarkService = new BookmarkService(app);
		
		// Try to get reference to Navigator Core
		this.tryConnectCore();
	}

	/**
	 * Refresh the cache of bookmarked paths
	 */
	refreshBookmarkCache(): void {
		this.bookmarkedPaths = this.bookmarkService.getBookmarkedPaths();
	}

	/**
	 * Check if a path is bookmarked
	 */
	isBookmarked(path: string): boolean {
		return this.bookmarkedPaths.has(path);
	}

	/**
	 * Attempt to connect to Navigator Core
	 */
	private tryConnectCore(): void {
		// Check if NavigatorCore is available globally
		if (typeof window !== 'undefined' && (window as any).NavigatorCore) {
			this.core = (window as any).NavigatorCore;
			console.log('Kanban 4000: Connected to Navigator Core');
		}
	}

	/**
	 * Check if connected to Navigator Core
	 */
	isConnectedToCore(): boolean {
		return this.core !== null;
	}

	/**
	 * Build board from folder - uses Core if available, fallback otherwise
	 */
	async buildBoard(folder: TFolder | null): Promise<KanbanList[]> {
		if (this.core) {
			return this.buildBoardWithCore(folder);
		}
		return this.buildBoardFallback(folder);
	}

	/**
	 * Build board using Navigator Core's DataProvider
	 */
	private async buildBoardWithCore(folder: TFolder | null): Promise<KanbanList[]> {
		if (!this.core) return [];

		const rootPath = folder?.path || '/';
		const viewState = this.core.getSharedState();
		
		// Get items from core with metadata
		const items = await this.core.getItems({
			path: rootPath,
			recursive: false,
			includeMetadata: ['tags', 'links']
		});

		const lists: KanbanList[] = [];
		const subfolders: any[] = [];
		const looseFiles: any[] = [];

		// Separate folders and files
		for (const item of items) {
			if (this.shouldExclude(item.title)) continue;
			
			if (item.type === 'folder') {
				subfolders.push(item);
			} else {
				looseFiles.push(item);
			}
		}

		// Create list for loose files
		if (looseFiles.length > 0) {
			const cards = await this.adapter.toKanbanCards(looseFiles, viewState);
			lists.push({
				title: folder?.name || 'Vault',
				path: rootPath,
				isLooseFiles: true,
				cards
			});
		}

		// Create list for each subfolder
		for (const subfolderItem of subfolders.sort((a, b) => a.title.localeCompare(b.title))) {
			// Get contents of subfolder
			const subfolderContents = await this.core!.getItems({
				path: subfolderItem.path,
				recursive: false,
				includeMetadata: ['tags', 'links']
			});

			const cards: KanbanCard[] = [];
			
			for (const item of subfolderContents) {
				if (this.shouldExclude(item.title)) continue;
				
				const card = await this.adapter.toKanbanCard(item, viewState);
				cards.push(card);
			}

			lists.push({
				title: subfolderItem.title,
				path: subfolderItem.path,
				isLooseFiles: false,
				cards
			});
		}

		return lists;
	}

	/**
	 * Build board without Navigator Core (fallback mode)
	 */
	private async buildBoardFallback(folder: TFolder | null): Promise<KanbanList[]> {
		const lists: KanbanList[] = [];
		
		if (!folder) {
			folder = this.app.vault.getRoot();
		}

		const children = folder.children || [];
		const subfolders: TFolder[] = [];
		const looseFiles: TAbstractFile[] = [];

		// Separate folders and files
		for (const child of children) {
			if (child.name.startsWith('.')) continue;
			if (this.shouldExclude(child.name)) continue;
			
			if (child instanceof TFolder) {
				subfolders.push(child);
			} else {
				looseFiles.push(child);
			}
		}

		// Create list for loose files
		if (looseFiles.length > 0) {
			const looseCards = await Promise.all(
				looseFiles.map(file => this.adapter.fromTFile(file as TFile))
			);
			lists.push({
				title: folder.name || 'Vault',
				path: folder.path,
				isLooseFiles: true,
				cards: looseCards
			});
		}

		// Create list for each subfolder
		for (const subfolder of subfolders.sort((a, b) => a.name.localeCompare(b.name))) {
			const folderContents = subfolder.children || [];
			const cards: KanbanCard[] = [];

			for (const item of folderContents) {
				if (item.name.startsWith('.')) continue;
				if (this.shouldExclude(item.name)) continue;
				
				if (item instanceof TFolder) {
					cards.push(this.adapter.fromTFolder(item));
				} else {
					const fileCard = await this.adapter.fromTFile(item as TFile);
					cards.push(fileCard);
				}
			}

			lists.push({
				title: subfolder.name,
				path: subfolder.path,
				isLooseFiles: false,
				cards
			});
		}

		return lists;
	}

	/**
	 * Check if item should be excluded
	 */
	private shouldExclude(name: string): boolean {
		if (name.startsWith('.')) return true;
		return this.excludePatterns.some(
			pattern => name.toLowerCase() === pattern.toLowerCase()
		);
	}

	/**
	 * Sort cards
	 */
	sortCards(cards: KanbanCard[], sortBy: SortOption, sortDirection: 'asc' | 'desc'): KanbanCard[] {
		const sorted = [...cards].sort((a, b) => {
			let comparison = 0;
			
			switch (sortBy) {
				case 'name':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'modified':
					const aModified = a.file?.stat.mtime || 0;
					const bModified = b.file?.stat.mtime || 0;
					comparison = bModified - aModified;
					break;
				case 'created':
					const aCreated = a.file?.stat.ctime || 0;
					const bCreated = b.file?.stat.ctime || 0;
					comparison = bCreated - aCreated;
					break;
			}
			
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		
		return sorted;
	}

	/**
	 * Filter cards by search query
	 */
	filterCards(cards: KanbanCard[], searchQuery: string): KanbanCard[] {
		if (!searchQuery.trim()) {
			return cards;
		}
		
		const query = searchQuery.toLowerCase();
		
		return cards.filter(card => {
			if (card.title.toLowerCase().includes(query)) return true;
			if (card.preview?.toLowerCase().includes(query)) return true;
			if (card.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
			return false;
		});
	}

	/**
	 * Filter cards by type
	 */
	filterByType(cards: KanbanCard[], typeFilters: CardType[]): KanbanCard[] {
		if (!typeFilters || typeFilters.length === 0) {
			return cards; // Show all when no filter selected
		}
		return cards.filter(card => typeFilters.includes(card.type));
	}

	/**
	 * Filter cards to only bookmarked items
	 */
	filterByBookmarks(cards: KanbanCard[]): KanbanCard[] {
		return cards.filter(card => this.isBookmarked(card.path));
	}

	/**
	 * Filter cards by tags
	 */
	filterByTags(cards: KanbanCard[], tagFilters: string[], mode: 'any' | 'all'): KanbanCard[] {
		if (!tagFilters || tagFilters.length === 0) {
			return cards;
		}

		return cards.filter(card => {
			if (!card.tags || card.tags.length === 0) {
				return false;
			}

			const cardTagsLower = card.tags.map(t => t.toLowerCase());
			const filterTagsLower = tagFilters.map(t => t.toLowerCase());

			if (mode === 'all') {
				// Card must have ALL selected tags
				return filterTagsLower.every(tag => cardTagsLower.includes(tag));
			} else {
				// Card must have ANY of the selected tags
				return filterTagsLower.some(tag => cardTagsLower.includes(tag));
			}
		});
	}

	/**
	 * Get date range from preset
	 */
	private getDateRangeFromPreset(preset: DatePreset): { start: number; end: number } {
		const now = new Date();
		const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
		const end = endOfDay.getTime();

		let start: number;
		switch (preset) {
			case 'today':
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
				break;
			case 'yesterday':
				const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
				start = yesterday.getTime();
				break;
			case 'week':
				const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
				start = weekAgo.getTime();
				break;
			case 'month':
				const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
				start = monthAgo.getTime();
				break;
			case 'year':
				const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
				start = yearAgo.getTime();
				break;
			default:
				start = 0;
		}

		return { start, end };
	}

	/**
	 * Filter cards by date range
	 */
	filterByDateRange(cards: KanbanCard[], dateFilter: DateFilter): KanbanCard[] {
		if (!dateFilter) {
			return cards;
		}

		let start: number;
		let end: number;

		if (dateFilter.preset) {
			const range = this.getDateRangeFromPreset(dateFilter.preset);
			start = range.start;
			end = range.end;
		} else {
			start = dateFilter.start || 0;
			end = dateFilter.end || Date.now();
		}

		return cards.filter(card => {
			if (!card.file) {
				// Folders don't have file stats, include them by default
				return card.type === 'folder';
			}

			const timestamp = dateFilter.field === 'created' 
				? card.file.stat.ctime 
				: card.file.stat.mtime;

			return timestamp >= start && timestamp <= end;
		});
	}

	/**
	 * Collect all unique tags from a list of cards
	 */
	collectAllTags(cards: KanbanCard[]): string[] {
		const tagSet = new Set<string>();
		for (const card of cards) {
			if (card.tags) {
				for (const tag of card.tags) {
					tagSet.add(tag);
				}
			}
		}
		return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
	}

	/**
	 * Process cards with filter and sort
	 */
	processCards(cards: KanbanCard[], state: BoardState): KanbanCard[] {
		let processed = cards;
		
		// Apply bookmark filter first if active
		if (state.showBookmarksOnly) {
			processed = this.filterByBookmarks(processed);
		}
		
		processed = this.filterByType(processed, state.typeFilters);
		processed = this.filterByTags(processed, state.tagFilters, state.tagFilterMode);
		
		if (state.dateFilter) {
			processed = this.filterByDateRange(processed, state.dateFilter);
		}
		
		processed = this.filterCards(processed, state.searchQuery);
		return this.sortCards(processed, state.sortBy, state.sortDirection);
	}

	/**
	 * Process all lists
	 */
	processLists(lists: KanbanList[], state: BoardState): KanbanList[] {
		// Refresh bookmark cache before processing if bookmark filter is active
		if (state.showBookmarksOnly) {
			this.refreshBookmarkCache();
		}
		
		const hasSearch = !!state.searchQuery?.trim();
		const hasTypes = state.typeFilters?.length > 0;
		const hasTags = state.tagFilters?.length > 0;
		const hasActiveFilters = hasSearch || hasTypes || hasTags || !!state.dateFilter || state.showBookmarksOnly;
		
		return lists.map(list => ({
			...list,
			cards: this.processCards(list.cards, state)
		})).filter(list => list.cards.length > 0 || !hasActiveFilters);
	}
}

import { App, TFolder, TFile, TAbstractFile } from 'obsidian';
import { KanbanList, KanbanCard, BoardState, getCardType, parseKanbanSyntax, extractTags, SortOption } from '../types';

/**
 * BoardBuilder handles the construction and manipulation of the kanban board data structure.
 * It builds the board from folder contents, converts files to cards, and handles sorting/filtering.
 */
export class BoardBuilder {
	constructor(
		private app: App,
		private excludePatterns: string[]
	) {}

	/**
	 * Build the board data structure from a folder
	 */
	async buildBoard(folder: TFolder | null): Promise<KanbanList[]> {
		const lists: KanbanList[] = [];
		
		if (!folder) {
			// Root of vault
			folder = this.app.vault.getRoot();
		}

		const children = folder.children || [];
		const subfolders: TFolder[] = [];
		const looseFiles: TAbstractFile[] = [];

		// Separate folders and files
		for (const child of children) {
			// Skip hidden folders and excluded patterns
			if (child.name.startsWith('.')) continue;
			if (this.excludePatterns.some(pattern => child.name.toLowerCase() === pattern.toLowerCase())) continue;
			
			if (child instanceof TFolder) {
				subfolders.push(child);
			} else {
				looseFiles.push(child);
			}
		}

		// If there are loose files, create a list for them with the folder name
		if (looseFiles.length > 0) {
			const looseCards = await Promise.all(
				looseFiles.map(file => this.fileToCard(file as TFile))
			);
			const looseList: KanbanList = {
				title: folder.name || 'Vault',
				path: folder.path,
				isLooseFiles: true,
				cards: looseCards
			};
			lists.push(looseList);
		}

		// Create a list for each subfolder
		for (const subfolder of subfolders.sort((a, b) => a.name.localeCompare(b.name))) {
			const folderContents = subfolder.children || [];
			const cards: KanbanCard[] = [];

			for (const item of folderContents) {
				if (item.name.startsWith('.')) continue;
				if (this.excludePatterns.some(pattern => item.name.toLowerCase() === pattern.toLowerCase())) continue;
				
				if (item instanceof TFolder) {
					// Subfolders become clickable cards that zoom in
					cards.push({
						title: item.name,
						path: item.path,
						type: 'folder',
						folder: item
					});
				} else {
					const fileCard = await this.fileToCard(item as TFile);
					cards.push(fileCard);
				}
			}

			lists.push({
				title: subfolder.name,
				path: subfolder.path,
				isLooseFiles: false,
				cards: cards
			});
		}

		return lists;
	}

	/**
	 * Convert a file to a card with preview, tags, and kanban detection
	 */
	async fileToCard(file: TFile): Promise<KanbanCard> {
		const extension = file.extension;
		const type = getCardType(extension);
		
		let preview: string | undefined;
		let tags: string[] = [];
		let hasKanbanSyntax = false;
		let kanbanLists = undefined;
		
		// Get preview text, tags, and kanban syntax for markdown files
		if (type === 'markdown') {
			try {
				const content = await this.app.vault.cachedRead(file);
				
				// Extract tags
				tags = extractTags(content);
				
				// Check for kanban syntax
				const parsedKanban = parseKanbanSyntax(content);
				if (parsedKanban) {
					hasKanbanSyntax = true;
					kanbanLists = parsedKanban;
				}
				
				// Strip frontmatter and get first ~100 chars
				const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');
				const cleanContent = withoutFrontmatter.trim();
				preview = cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : '');
			} catch (e) {
				preview = undefined;
			}
		}
		
		return {
			title: type === 'markdown' ? file.basename : file.name,
			path: file.path,
			type: type,
			file: file,
			preview: preview,
			tags: tags,
			hasKanbanSyntax: hasKanbanSyntax,
			kanbanLists: kanbanLists
		};
	}

	/**
	 * Sort cards based on sort settings
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
					comparison = bModified - aModified; // Newer first by default
					break;
				case 'created':
					const aCreated = a.file?.stat.ctime || 0;
					const bCreated = b.file?.stat.ctime || 0;
					comparison = bCreated - aCreated; // Newer first by default
					break;
			}
			
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		
		return sorted;
	}

	/**
	 * Filter cards based on search query
	 */
	filterCards(cards: KanbanCard[], searchQuery: string): KanbanCard[] {
		if (!searchQuery.trim()) {
			return cards;
		}
		
		const query = searchQuery.toLowerCase();
		
		return cards.filter(card => {
			// Search in title
			if (card.title.toLowerCase().includes(query)) return true;
			
			// Search in preview
			if (card.preview?.toLowerCase().includes(query)) return true;
			
			// Search in tags
			if (card.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
			
			return false;
		});
	}

	/**
	 * Apply both filtering and sorting to cards
	 */
	processCards(cards: KanbanCard[], state: BoardState): KanbanCard[] {
		const filtered = this.filterCards(cards, state.searchQuery);
		return this.sortCards(filtered, state.sortBy, state.sortDirection);
	}

	/**
	 * Process all lists - filter and sort cards in each list
	 */
	processLists(lists: KanbanList[], state: BoardState): KanbanList[] {
		return lists.map(list => ({
			...list,
			cards: this.processCards(list.cards, state)
		})).filter(list => list.cards.length > 0 || !state.searchQuery);
	}
}

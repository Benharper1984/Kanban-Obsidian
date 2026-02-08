/**
 * Kanban 4000 - VaultItem Adapter
 * Converts VaultItem from Navigator Core to KanbanCard
 */

import { App, TFile, TFolder } from 'obsidian';
import { 
	KanbanCard, 
	CardType, 
	getCardType, 
	parseKanbanSyntax 
} from '../types';

// Navigator Core types (mirrored for when core isn't available)
interface VaultItem {
	path: string;
	title: string;
	type: 'file' | 'folder' | 'link';
	file?: TFile;
	folder?: TFolder;
	metadata: {
		tags: string[];
		preview?: string;
		fileType?: 'markdown' | 'image' | 'attachment';
	};
}

interface ViewState {
	focusedItem?: string;
	selectedItems: string[];
}

/**
 * Adapter to convert VaultItem to KanbanCard
 */
export class VaultItemAdapter {
	constructor(private app: App) {}

	/**
	 * Convert a VaultItem to a KanbanCard
	 */
	async toKanbanCard(item: VaultItem, viewState?: ViewState): Promise<KanbanCard> {
		const card: KanbanCard = {
			title: item.title,
			path: item.path,
			type: this.mapItemType(item),
			tags: item.metadata.tags,
			preview: item.metadata.preview,
			isHighlighted: viewState?.focusedItem === item.path,
			isSelected: viewState?.selectedItems?.includes(item.path) ?? false
		};

		// Attach file/folder references
		if (item.file) {
			card.file = item.file;
		}
		if (item.folder) {
			card.folder = item.folder;
		}

		// Check for kanban syntax in markdown files
		if (item.type === 'file' && item.file && item.metadata.fileType === 'markdown') {
			await this.enrichWithKanbanSyntax(card, item.file);
		}

		return card;
	}

	/**
	 * Convert multiple VaultItems to KanbanCards
	 */
	async toKanbanCards(items: VaultItem[], viewState?: ViewState): Promise<KanbanCard[]> {
		return Promise.all(items.map(item => this.toKanbanCard(item, viewState)));
	}

	/**
	 * Map VaultItem type to CardType
	 */
	private mapItemType(item: VaultItem): CardType {
		if (item.type === 'folder') {
			return 'folder';
		}
		
		if (item.file) {
			return getCardType(item.file.extension);
		}
		
		// Fallback to file type from metadata
		if (item.metadata.fileType) {
			return item.metadata.fileType;
		}
		
		return 'attachment';
	}

	/**
	 * Enrich card with kanban syntax if present
	 */
	private async enrichWithKanbanSyntax(card: KanbanCard, file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.cachedRead(file);
			const kanbanLists = parseKanbanSyntax(content);
			
			if (kanbanLists) {
				card.hasKanbanSyntax = true;
				card.kanbanLists = kanbanLists;
			}
		} catch (e) {
			// Silently fail - file might not be accessible
		}
	}

	/**
	 * Create a KanbanCard directly from TFile (fallback when core not available)
	 */
	async fromTFile(file: TFile): Promise<KanbanCard> {
		const extension = file.extension;
		const type = getCardType(extension);
		
		let preview: string | undefined;
		let tags: string[] = [];
		let hasKanbanSyntax = false;
		let kanbanLists = undefined;
		
		if (type === 'markdown') {
			try {
				const content = await this.app.vault.cachedRead(file);
				
				// Extract tags (simple regex)
				const tagRegex = /#([a-zA-Z0-9_-]+)/g;
				let match;
				while ((match = tagRegex.exec(content)) !== null) {
					if (!match[1].match(/^[0-9]+$/)) {
						tags.push(match[1]);
					}
				}
				
				// Check for kanban syntax
				const parsedKanban = parseKanbanSyntax(content);
				if (parsedKanban) {
					hasKanbanSyntax = true;
					kanbanLists = parsedKanban;
				}
				
				// Get preview text
				const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');
				const cleanContent = withoutFrontmatter.trim();
				preview = cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : '');
			} catch (e) {
				// Ignore errors
			}
		}
		
		return {
			title: type === 'markdown' ? file.basename : file.name,
			path: file.path,
			type,
			file,
			preview,
			tags,
			hasKanbanSyntax,
			kanbanLists
		};
	}

	/**
	 * Create a KanbanCard from TFolder
	 */
	fromTFolder(folder: TFolder): KanbanCard {
		return {
			title: folder.name,
			path: folder.path,
			type: 'folder',
			folder
		};
	}
}

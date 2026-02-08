/**
 * Kanban 4000 - Navigator View Plugin
 * Implements NavigatorViewPlugin interface to register with Navigator Core
 */

import { WorkspaceLeaf, TFolder } from 'obsidian';
import { 
	NavigatorViewPlugin, 
	NavigatorView, 
	ViewPluginManifest,
	VaultItem,
	ViewState,
	FilterState,
	MetadataType,
	NavigatorCore
} from './types';
import { CoreStateSync, applyHighlighting } from './CoreStateSync';
import { VaultItemAdapter } from './VaultItemAdapter';
import { KanbanList, KanbanCard } from '../types';
import Kanban4000Plugin from '../main';

/**
 * Kanban View Plugin implementation
 * Registers Kanban 4000 with Navigator Core
 */
export class KanbanViewPlugin implements NavigatorViewPlugin {
	manifest: ViewPluginManifest = {
		id: 'kanban-4000',
		name: 'Kanban Board',
		icon: 'layout-dashboard',
		description: 'View vault items as a kanban board organized by folders'
	};

	private plugin: Kanban4000Plugin;
	private stateSync: CoreStateSync;

	constructor(plugin: Kanban4000Plugin) {
		this.plugin = plugin;
		this.stateSync = new CoreStateSync();
	}

	/**
	 * Called when registered with Navigator Core
	 */
	onRegister(core: NavigatorCore): void {
		this.stateSync.connect(core);
		console.log('Kanban 4000: Registered with Navigator Core');
	}

	/**
	 * Called when unregistered from Navigator Core
	 */
	onUnregister(): void {
		this.stateSync.disconnect();
		console.log('Kanban 4000: Unregistered from Navigator Core');
	}

	/**
	 * Create a view instance - returns a KanbanNavigatorView wrapper
	 */
	createView(leaf: WorkspaceLeaf): NavigatorView {
		return new KanbanNavigatorView(leaf, this.plugin, this.stateSync);
	}

	/**
	 * Declare required metadata types
	 */
	requiredMetadata(): MetadataType[] {
		return ['tags', 'links'];
	}

	/**
	 * Check if kanban can display an item
	 */
	canDisplayItem(item: VaultItem): boolean {
		// Kanban can display any file or folder
		return item.type === 'file' || item.type === 'folder';
	}

	/**
	 * Get currently highlighted items for cross-view sync
	 */
	getHighlightedItems(): string[] {
		return this.stateSync.getHighlightedItems();
	}

	/**
	 * Get the CoreStateSync instance (for sharing with KanbanView)
	 */
	getStateSync(): CoreStateSync {
		return this.stateSync;
	}

	/**
	 * Get reference to Navigator Core
	 */
	getCore(): NavigatorCore | null {
		return this.stateSync.getCore();
	}
}

/**
 * Navigator View implementation for Kanban
 * Wraps existing kanban functionality in NavigatorView interface
 */
class KanbanNavigatorView implements NavigatorView {
	private leaf: WorkspaceLeaf;
	private plugin: Kanban4000Plugin;
	private stateSync: CoreStateSync;
	private adapter: VaultItemAdapter;
	private containerEl: HTMLElement | null = null;
	private currentPath: string = '/';
	private currentState: ViewState | null = null;
	private stateUnsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Kanban4000Plugin, stateSync: CoreStateSync) {
		this.leaf = leaf;
		this.plugin = plugin;
		this.stateSync = stateSync;
		this.adapter = new VaultItemAdapter(plugin.app);
		
		// Subscribe to state changes for highlighting updates
		this.stateUnsubscribe = stateSync.onStateChange((state) => {
			this.onSharedStateChange(state);
		});
	}

	/**
	 * Render items with current state
	 */
	render(items: VaultItem[], state: ViewState): void {
		this.currentState = state;
		
		// If we have a container, render into it
		if (this.containerEl) {
			this.renderBoard(items, state);
		}
	}

	/**
	 * Render the kanban board from VaultItems
	 */
	private async renderBoard(items: VaultItem[], state: ViewState): Promise<void> {
		if (!this.containerEl) return;
		
		// Convert VaultItems to KanbanCards using the adapter
		const cards = await this.adapter.toKanbanCards(items, state);
		
		// Group cards into lists (by parent folder)
		const lists = this.groupCardsIntoLists(cards);
		
		// The actual rendering would use BoardRenderer here
		// For now, this bridges the gap between core and existing renderer
		// The KanbanView still handles the main rendering - this provides
		// core-driven data when available
	}

	/**
	 * Group cards into KanbanLists by their parent folder
	 */
	private groupCardsIntoLists(cards: KanbanCard[]): KanbanList[] {
		const folderMap = new Map<string, KanbanCard[]>();
		const looseFiles: KanbanCard[] = [];
		
		for (const card of cards) {
			if (card.type === 'folder') {
				// Folders become their own list headers
				const folderPath = card.path;
				if (!folderMap.has(folderPath)) {
					folderMap.set(folderPath, []);
				}
			} else {
				// Files go into their parent folder's list
				const parentPath = card.path.substring(0, card.path.lastIndexOf('/')) || '/';
				if (parentPath === this.currentPath || parentPath === '/') {
					looseFiles.push(card);
				} else if (folderMap.has(parentPath)) {
					folderMap.get(parentPath)!.push(card);
				}
			}
		}
		
		const lists: KanbanList[] = [];
		
		// Add loose files list first
		if (looseFiles.length > 0) {
			lists.push({
				title: 'Files',
				path: this.currentPath,
				isLooseFiles: true,
				cards: looseFiles
			});
		}
		
		// Add folder lists
		for (const [path, folderCards] of folderMap) {
			const folderName = path.split('/').pop() || path;
			lists.push({
				title: folderName,
				path: path,
				isLooseFiles: false,
				cards: folderCards
			});
		}
		
		return lists;
	}

	/**
	 * Handle item selection
	 */
	onItemSelect(path: string): void {
		this.stateSync.setFocusedItem(path);
	}

	/**
	 * Handle filter changes
	 */
	onFilterChange(filters: FilterState): void {
		const core = this.stateSync.getCore();
		if (core) {
			core.updateFilters(filters);
		}
	}

	/**
	 * Get current view state
	 */
	getState(): ViewState {
		return this.currentState || {
			focusedItem: undefined,
			selectedItems: [],
			filters: {
				search: '',
				tags: [],
				fileTypes: []
			},
			viewSpecific: {
				currentPath: this.currentPath
			}
		};
	}

	/**
	 * Restore view state
	 */
	setState(state: ViewState): void {
		this.currentState = state;
		
		// Extract kanban-specific state
		if (state.viewSpecific.currentPath) {
			this.currentPath = state.viewSpecific.currentPath as string;
		}
	}

	/**
	 * Cleanup resources
	 */
	cleanup(): void {
		if (this.stateUnsubscribe) {
			this.stateUnsubscribe();
			this.stateUnsubscribe = null;
		}
		this.containerEl = null;
		this.currentState = null;
	}

	/**
	 * Handle shared state changes (cross-view highlighting)
	 */
	onSharedStateChange(state: ViewState): void {
		// Use centralized highlighting function
		if (this.containerEl) {
			applyHighlighting(this.containerEl, state);
		}
	}
}

export { KanbanNavigatorView };

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
import Kanban4000Plugin from '../main';

/**
 * Kanban View Plugin implementation
 * Registers Kanban 4000 with Navigator Core
 */
export class KanbanViewPlugin implements NavigatorViewPlugin {
	manifest: ViewPluginManifest = {
		id: 'kanban',
		name: 'Kanban Board',
		icon: 'layout-dashboard',
		description: 'View vault items as a kanban board organized by folders'
	};

	private plugin: Kanban4000Plugin;
	private core: NavigatorCore | null = null;
	private highlightedItems: string[] = [];

	constructor(plugin: Kanban4000Plugin) {
		this.plugin = plugin;
	}

	/**
	 * Called when registered with Navigator Core
	 */
	onRegister(core: NavigatorCore): void {
		this.core = core;
		console.log('Kanban 4000: Registered with Navigator Core');
		
		// Subscribe to state changes for cross-view highlighting
		core.on('state-change', (payload: { current: ViewState; previous: ViewState }) => {
			const { current } = payload;
			if (current.focusedItem) {
				this.highlightedItems = [current.focusedItem, ...current.selectedItems];
			} else {
				this.highlightedItems = [...current.selectedItems];
			}
		});
	}

	/**
	 * Called when unregistered from Navigator Core
	 */
	onUnregister(): void {
		this.core = null;
		this.highlightedItems = [];
		console.log('Kanban 4000: Unregistered from Navigator Core');
	}

	/**
	 * Create a view instance - returns a KanbanNavigatorView wrapper
	 */
	createView(leaf: WorkspaceLeaf): NavigatorView {
		return new KanbanNavigatorView(leaf, this.plugin, this.core);
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
		return this.highlightedItems;
	}

	/**
	 * Get reference to Navigator Core
	 */
	getCore(): NavigatorCore | null {
		return this.core;
	}
}

/**
 * Navigator View implementation for Kanban
 * Wraps existing kanban functionality in NavigatorView interface
 */
class KanbanNavigatorView implements NavigatorView {
	private leaf: WorkspaceLeaf;
	private plugin: Kanban4000Plugin;
	private core: NavigatorCore | null;
	private containerEl: HTMLElement | null = null;
	private currentPath: string = '/';
	private currentState: ViewState | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Kanban4000Plugin, core: NavigatorCore | null) {
		this.leaf = leaf;
		this.plugin = plugin;
		this.core = core;
	}

	/**
	 * Render items with current state
	 */
	render(items: VaultItem[], state: ViewState): void {
		this.currentState = state;
		
		// The actual rendering is delegated to KanbanView
		// This is called by NavigatorViewWrapper
		// We store the state for reference
		
		// If we have a container, render into it
		if (this.containerEl) {
			this.renderBoard(items, state);
		}
	}

	/**
	 * Render the kanban board
	 */
	private renderBoard(items: VaultItem[], state: ViewState): void {
		// This will be called by the view wrapper
		// Actual board rendering is handled by existing BoardRenderer
		// We just need to transform items appropriately
	}

	/**
	 * Handle item selection
	 */
	onItemSelect(path: string): void {
		if (this.core) {
			// Update shared state when an item is selected
			this.core.updateSharedState({
				focusedItem: path
			});
		}
	}

	/**
	 * Handle filter changes
	 */
	onFilterChange(filters: FilterState): void {
		if (this.core) {
			this.core.updateFilters(filters);
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
		this.containerEl = null;
		this.currentState = null;
	}

	/**
	 * Handle shared state changes (cross-view highlighting)
	 */
	onSharedStateChange(state: ViewState): void {
		// Update highlighting based on shared state
		if (this.containerEl) {
			this.updateHighlighting(state);
		}
	}

	/**
	 * Update card highlighting based on shared state
	 */
	private updateHighlighting(state: ViewState): void {
		if (!this.containerEl) return;

		// Remove existing highlights
		this.containerEl.querySelectorAll('.kanban-card-highlighted').forEach(el => {
			el.removeClass('kanban-card-highlighted');
		});
		this.containerEl.querySelectorAll('.kanban-card-selected').forEach(el => {
			el.removeClass('kanban-card-selected');
		});

		// Add highlight to focused item
		if (state.focusedItem) {
			const focusedCard = this.containerEl.querySelector(
				`[data-path="${state.focusedItem}"]`
			);
			if (focusedCard) {
				focusedCard.addClass('kanban-card-highlighted');
			}
		}

		// Add selection to selected items
		for (const path of state.selectedItems) {
			const selectedCard = this.containerEl.querySelector(`[data-path="${path}"]`);
			if (selectedCard) {
				selectedCard.addClass('kanban-card-selected');
			}
		}
	}
}

export { KanbanNavigatorView };

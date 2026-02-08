/**
 * Kanban 4000 - Core State Sync
 * Centralized Navigator Core state subscription and syncing
 */

import { NavigatorCore, ViewState, FilterState } from './types';

/** Callback for state change events */
export type StateChangeCallback = (state: ViewState) => void;

/** Callback for filter sync events */
export type FilterSyncCallback = (filters: FilterState) => void;

/**
 * CoreStateSync - Centralized state synchronization with Navigator Core
 * 
 * Handles:
 * - Subscribing to core state changes
 * - Updating shared state (focused item, selection)
 * - Syncing filters (search, tags, etc.)
 * - Cross-view highlighting coordination
 */
export class CoreStateSync {
	private core: NavigatorCore | null = null;
	private unsubscribe: (() => void) | null = null;
	private stateCallbacks: Set<StateChangeCallback> = new Set();
	private lastKnownState: ViewState | null = null;

	/**
	 * Connect to Navigator Core
	 */
	connect(core: NavigatorCore): void {
		// Disconnect from any previous core
		this.disconnect();
		
		this.core = core;
		
		// Subscribe to state changes
		this.unsubscribe = core.on('state-change', (payload: { current: ViewState; previous: ViewState }) => {
			this.lastKnownState = payload.current;
			this.notifyStateChange(payload.current);
		});
		
		// Get initial state
		this.lastKnownState = core.getSharedState();
	}

	/**
	 * Disconnect from Navigator Core
	 */
	disconnect(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.core = null;
		this.lastKnownState = null;
	}

	/**
	 * Check if connected to core
	 */
	isConnected(): boolean {
		return this.core !== null;
	}

	/**
	 * Get current Navigator Core reference
	 */
	getCore(): NavigatorCore | null {
		return this.core;
	}

	/**
	 * Subscribe to state changes
	 */
	onStateChange(callback: StateChangeCallback): () => void {
		this.stateCallbacks.add(callback);
		
		// Don't immediately call - let the view initialize first
		// The view will call getState() when ready
		
		// Return unsubscribe function
		return () => {
			this.stateCallbacks.delete(callback);
		};
	}

	/**
	 * Get the last known shared state
	 */
	getState(): ViewState | null {
		return this.lastKnownState;
	}

	/**
	 * Update focused item (when user clicks a card)
	 */
	setFocusedItem(path: string): void {
		if (this.core) {
			this.core.updateSharedState({ focusedItem: path });
		}
	}

	/**
	 * Update selected items
	 */
	setSelectedItems(paths: string[]): void {
		if (this.core) {
			this.core.updateSharedState({ selectedItems: paths });
		}
	}

	/**
	 * Add item to selection
	 */
	addToSelection(path: string): void {
		if (this.core && this.lastKnownState) {
			const current = this.lastKnownState.selectedItems || [];
			if (!current.includes(path)) {
				this.core.updateSharedState({ 
					selectedItems: [...current, path] 
				});
			}
		}
	}

	/**
	 * Clear selection
	 */
	clearSelection(): void {
		if (this.core) {
			this.core.updateSharedState({ 
				focusedItem: undefined,
				selectedItems: [] 
			});
		}
	}

	/**
	 * Sync search query with core
	 */
	syncSearch(query: string): void {
		if (this.core) {
			this.core.updateFilters({ search: query });
		}
	}

	/**
	 * Sync tag filters with core
	 */
	syncTags(tags: string[]): void {
		if (this.core) {
			this.core.updateFilters({ tags });
		}
	}

	/**
	 * Sync file type filters with core
	 */
	syncFileTypes(fileTypes: string[]): void {
		if (this.core) {
			this.core.updateFilters({ fileTypes });
		}
	}

	/**
	 * Get highlighted items (focused + selected)
	 */
	getHighlightedItems(): string[] {
		if (!this.lastKnownState) return [];
		
		const items: string[] = [];
		if (this.lastKnownState.focusedItem) {
			items.push(this.lastKnownState.focusedItem);
		}
		items.push(...(this.lastKnownState.selectedItems || []));
		return items;
	}

	/**
	 * Check if an item is highlighted
	 */
	isHighlighted(path: string): boolean {
		if (!this.lastKnownState) return false;
		return this.lastKnownState.focusedItem === path;
	}

	/**
	 * Check if an item is selected
	 */
	isSelected(path: string): boolean {
		if (!this.lastKnownState) return false;
		return (this.lastKnownState.selectedItems || []).includes(path);
	}

	/**
	 * Notify all callbacks of state change
	 */
	private notifyStateChange(state: ViewState): void {
		for (const callback of this.stateCallbacks) {
			try {
				callback(state);
			} catch (error) {
				console.error('CoreStateSync: Error in state change callback', error);
			}
		}
	}
}

/**
 * Apply highlighting to a container element based on state
 */
export function applyHighlighting(
	container: HTMLElement,
	state: ViewState | null
): void {
	if (!container) return;

	// Remove existing highlights
	container.querySelectorAll('.kanban-card-highlighted').forEach(el => {
		el.removeClass('kanban-card-highlighted');
	});
	container.querySelectorAll('.kanban-card-selected').forEach(el => {
		el.removeClass('kanban-card-selected');
	});

	if (!state) return;

	// Add highlight to focused item
	if (state.focusedItem) {
		const focusedCard = container.querySelector(`[data-path="${state.focusedItem}"]`);
		if (focusedCard) {
			focusedCard.addClass('kanban-card-highlighted');
			// Scroll into view if not visible
			(focusedCard as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	// Add selection styling to selected items
	for (const path of (state.selectedItems || [])) {
		const selectedCard = container.querySelector(`[data-path="${path}"]`);
		if (selectedCard) {
			selectedCard.addClass('kanban-card-selected');
		}
	}
}

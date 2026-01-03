import { TFolder } from 'obsidian';
import { BoardState, SortOption, CardType, SavedFilter, DEFAULT_SAVED_FILTERS } from '../types';
import { Icons, getFilterIcon } from '../components';

export interface ToolbarCallbacks {
	onSearchChange: (query: string) => Promise<void>;
	onSortChange: (sortBy: SortOption) => Promise<void>;
	onSortDirectionToggle: () => Promise<void>;
	onTypeFilterChange: (types: CardType[]) => Promise<void>;
	onNavigateBack: () => Promise<void>;
	onNavigateToBreadcrumb: (index: number) => Promise<void>;
}

/**
 * ToolbarRenderer handles rendering the header, breadcrumbs, search, sort, and action buttons.
 */
export class ToolbarRenderer {
	private searchInputEl: HTMLInputElement | null = null;
	private searchTimeout: NodeJS.Timeout | undefined;

	constructor(private callbacks: ToolbarCallbacks) {}

	/**
	 * Get the search input element (for focus)
	 */
	getSearchInput(): HTMLInputElement | null {
		return this.searchInputEl;
	}

	/**
	 * Set the search query value (for external sync)
	 */
	setSearchQuery(query: string): void {
		if (this.searchInputEl && this.searchInputEl.value !== query) {
			this.searchInputEl.value = query;
		}
	}

	/**
	 * Render the header with navigation breadcrumbs
	 */
	renderHeader(container: HTMLElement, folder: TFolder, state: BoardState): void {
		const header = container.createEl('div', { cls: 'kanban-header' });

		// Back button
		if (state.history.length > 0) {
			const backBtn = header.createEl('button', { 
				cls: 'kanban-back-btn',
				attr: { 'aria-label': 'Go back' }
			});
			backBtn.innerHTML = Icons.back;
			backBtn.onclick = () => this.callbacks.onNavigateBack();
		}

		// Breadcrumbs
		this.renderBreadcrumbs(header, state.currentPath);
	}

	/**
	 * Render breadcrumb navigation
	 */
	private renderBreadcrumbs(header: HTMLElement, currentPath: string): void {
		const breadcrumbs = header.createEl('div', { cls: 'kanban-breadcrumbs' });
		
		// Always show vault root
		const rootCrumb = breadcrumbs.createEl('span', { 
			cls: 'kanban-breadcrumb',
			text: '🏠 Vault'
		});
		rootCrumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(0);

		// Build path parts
		if (currentPath !== '/') {
			const parts = currentPath.split('/').filter(p => p);
			
			for (let i = 0; i < parts.length; i++) {
				breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb-separator', text: ' / ' });
				
				const crumb = breadcrumbs.createEl('span', { 
					cls: 'kanban-breadcrumb',
					text: parts[i]
				});
				
				if (i < parts.length - 1) {
					// Make intermediate crumbs clickable
					const crumbIndex = i + 1;
					crumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(crumbIndex);
				} else {
					// Current folder - not clickable, highlight differently
					crumb.addClass('kanban-breadcrumb-current');
				}
			}
		}
	}

	/**
	 * Render the search and sort toolbar
	 */
	renderToolbar(container: HTMLElement, state: BoardState): void {
		const toolbar = container.createEl('div', { cls: 'kanban-toolbar' });
		
		// Filter chips (saved filter views)
		this.renderFilterChips(toolbar, state);
		
		// Search input
		this.renderSearchInput(toolbar, state.searchQuery);
		
		// Sort controls
		this.renderSortControls(toolbar, state);
	}

	/**
	 * Render filter chips for quick type filtering
	 */
	private renderFilterChips(toolbar: HTMLElement, state: BoardState): void {
		const filtersContainer = toolbar.createEl('div', { cls: 'kanban-filters' });
		
		for (const filter of DEFAULT_SAVED_FILTERS) {
			const isActive = this.isFilterActive(filter, state.typeFilters);
			
			const chip = filtersContainer.createEl('button', {
				cls: `kanban-filter-chip ${isActive ? 'kanban-filter-chip-active' : ''}`,
				attr: { 'aria-label': `Filter: ${filter.name}` }
			});
			
			if (filter.icon) {
				const iconEl = chip.createEl('span', { cls: 'kanban-filter-chip-icon' });
				iconEl.innerHTML = getFilterIcon(filter.icon);
			}
			
			chip.createEl('span', { 
				cls: 'kanban-filter-chip-label',
				text: filter.name 
			});
			
			chip.onclick = () => this.callbacks.onTypeFilterChange(filter.typeFilters);
		}
	}

	/**
	 * Check if a filter matches the current state
	 */
	private isFilterActive(filter: SavedFilter, currentFilters: CardType[]): boolean {
		if (filter.typeFilters.length === 0 && currentFilters.length === 0) {
			return true; // "All" filter
		}
		if (filter.typeFilters.length !== currentFilters.length) {
			return false;
		}
		return filter.typeFilters.every(t => currentFilters.includes(t));
	}

	/**
	 * Render the search input
	 */
	private renderSearchInput(toolbar: HTMLElement, searchQuery: string): void {
		const searchContainer = toolbar.createEl('div', { cls: 'kanban-search' });
		const searchIcon = searchContainer.createEl('span', { cls: 'kanban-search-icon' });
		searchIcon.innerHTML = Icons.search;
		
		this.searchInputEl = searchContainer.createEl('input', {
			cls: 'kanban-search-input',
			attr: { 
				type: 'text', 
				placeholder: 'Search cards...'
			}
		});
		// Set value after creation to avoid cursor issues
		this.searchInputEl.value = searchQuery;
		
		// Debounced search - only re-render the board, not the whole view
		this.searchInputEl.oninput = (e) => {
			const input = e.target as HTMLInputElement;
			
			clearTimeout(this.searchTimeout);
			this.searchTimeout = setTimeout(async () => {
				await this.callbacks.onSearchChange(input.value);
			}, 300);
		};
		
		// Clear search button
		if (searchQuery) {
			const clearBtn = searchContainer.createEl('span', { cls: 'kanban-search-clear' });
			clearBtn.innerHTML = Icons.close;
			clearBtn.onclick = async () => {
				if (this.searchInputEl) {
					this.searchInputEl.value = '';
				}
				await this.callbacks.onSearchChange('');
			};
		}
	}

	/**
	 * Render sort controls
	 */
	private renderSortControls(toolbar: HTMLElement, state: BoardState): void {
		const sortContainer = toolbar.createEl('div', { cls: 'kanban-sort' });
		
		sortContainer.createEl('span', { 
			cls: 'kanban-sort-label',
			text: 'Sort:' 
		});
		
		const sortSelect = sortContainer.createEl('select', { cls: 'kanban-sort-select' });
		
		const sortOptions: { value: SortOption; label: string }[] = [
			{ value: 'name', label: 'Name' },
			{ value: 'modified', label: 'Modified' },
			{ value: 'created', label: 'Created' }
		];
		
		for (const opt of sortOptions) {
			const option = sortSelect.createEl('option', {
				text: opt.label,
				attr: { value: opt.value }
			});
			if (opt.value === state.sortBy) {
				option.selected = true;
			}
		}
		
		sortSelect.onchange = async () => {
			await this.callbacks.onSortChange(sortSelect.value as SortOption);
		};
		
		// Sort direction toggle
		const directionBtn = sortContainer.createEl('button', { 
			cls: 'kanban-sort-direction',
			attr: { 'aria-label': 'Toggle sort direction' }
		});
		directionBtn.innerHTML = state.sortDirection === 'asc' 
			? Icons.chevronUp
			: Icons.chevronDown;
		
		directionBtn.onclick = async () => {
			await this.callbacks.onSortDirectionToggle();
		};
	}
}

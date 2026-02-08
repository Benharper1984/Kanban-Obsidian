import { TFolder } from 'obsidian';
import { BoardState, SortOption, CardType, SavedFilter, DEFAULT_SAVED_FILTERS, DateFilter, DatePreset } from '../types';
import { Icons, getFilterIcon } from '../components';

export interface ToolbarCallbacks {
	onSearchChange: (query: string) => Promise<void>;
	onSortChange: (sortBy: SortOption) => Promise<void>;
	onSortDirectionToggle: () => Promise<void>;
	onTypeFilterChange: (types: CardType[]) => Promise<void>;
	onBookmarkFilterToggle: (active: boolean) => Promise<void>;
	onTagFilterChange: (tags: string[], mode: 'any' | 'all') => Promise<void>;
	onDateFilterChange: (filter: DateFilter | undefined) => Promise<void>;
	onClearAllFilters: () => Promise<void>;
	onNavigateBack: () => Promise<void>;
	onNavigateToBreadcrumb: (index: number) => Promise<void>;
	// Saved filter callbacks
	onSaveFilter?: () => void;
	onApplySavedFilter?: (filter: SavedFilter) => void;
	onDeleteSavedFilter?: (filterId: string) => void;
}

/**
 * ToolbarRenderer handles rendering the header, breadcrumbs, search, sort, and action buttons.
 */
export class ToolbarRenderer {
	private searchInputEl: HTMLInputElement | null = null;
	private searchTimeout: NodeJS.Timeout | undefined;
	private availableTags: string[] = [];
	private activeDropdown: HTMLElement | null = null;
	private documentClickHandler: ((e: MouseEvent) => void) | null = null;
	// Track which dropdown type should remain open across re-renders
	private keepDropdownOpen: 'tag' | 'date' | null = null;

	constructor(private callbacks: ToolbarCallbacks) {}

	/**
	 * Set available tags for the tag filter dropdown
	 */
	setAvailableTags(tags: string[]): void {
		this.availableTags = tags;
	}

	/**
	 * Close any open dropdown
	 */
	private closeActiveDropdown(): void {
		if (this.activeDropdown) {
			this.activeDropdown.style.display = 'none';
			this.activeDropdown = null;
		}
		if (this.documentClickHandler) {
			document.removeEventListener('click', this.documentClickHandler);
			this.documentClickHandler = null;
		}
	}

	/**
	 * Open a dropdown and set up close handler
	 */
	private openDropdown(dropdown: HTMLElement, container: HTMLElement): void {
		// Close any existing dropdown first
		this.closeActiveDropdown();
		
		// Open this dropdown
		dropdown.style.display = 'block';
		this.activeDropdown = dropdown;
		
		// Set up document click handler to close on outside click
		this.documentClickHandler = (e: MouseEvent) => {
			if (!container.contains(e.target as Node)) {
				this.closeActiveDropdown();
			}
		};
		
		// Delay adding listener to avoid immediate trigger
		setTimeout(() => {
			if (this.documentClickHandler) {
				document.addEventListener('click', this.documentClickHandler);
			}
		}, 0);
	}

	/**
	 * Toggle a dropdown
	 */
	private toggleDropdown(dropdown: HTMLElement, container: HTMLElement): void {
		const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
		if (isHidden) {
			this.openDropdown(dropdown, container);
		} else {
			this.closeActiveDropdown();
		}
	}

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
	renderHeader(container: HTMLElement, folder: TFolder, state: BoardState, itemCount?: number): void {
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
		this.renderBreadcrumbs(header, state.currentPath, itemCount);
	}

	/**
	 * Render breadcrumb navigation with optional item count
	 */
	private renderBreadcrumbs(header: HTMLElement, currentPath: string, itemCount?: number): void {
		const breadcrumbs = header.createEl('div', { cls: 'kanban-breadcrumbs' });
		
		// Always show vault root
		const rootCrumb = breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb' });
		rootCrumb.createEl('span', { text: '🏠 Vault' });
		
		// Show count on root if we're at root
		if (currentPath === '/' && itemCount !== undefined) {
			rootCrumb.createEl('span', { 
				cls: 'kanban-breadcrumb-count',
				text: ` (${itemCount})`
			});
		}
		
		rootCrumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(0);

		// Build path parts
		if (currentPath !== '/') {
			const parts = currentPath.split('/').filter(p => p);
			
			for (let i = 0; i < parts.length; i++) {
				breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb-separator', text: ' / ' });
				
				const crumb = breadcrumbs.createEl('span', { cls: 'kanban-breadcrumb' });
				crumb.createEl('span', { text: parts[i] });
				
				if (i < parts.length - 1) {
					// Make intermediate crumbs clickable
					const crumbIndex = i + 1;
					crumb.onclick = () => this.callbacks.onNavigateToBreadcrumb(crumbIndex);
				} else {
					// Current folder - not clickable, highlight differently
					crumb.addClass('kanban-breadcrumb-current');
					
					// Add count to current breadcrumb
					if (itemCount !== undefined) {
						crumb.createEl('span', { 
							cls: 'kanban-breadcrumb-count',
							text: ` (${itemCount})`
						});
					}
				}
			}
		}
	}

	/**
	 * Render the search and sort toolbar
	 */
	renderToolbar(container: HTMLElement, state: BoardState, savedFilters: SavedFilter[] = []): void {
		const toolbar = container.createEl('div', { cls: 'kanban-toolbar' });
		
		// Primary row: filter chips with horizontal scroll
		const filterSection = toolbar.createEl('div', { cls: 'kanban-filter-section' });
		
		// Default filter chips (saved filter views)
		this.renderFilterChips(filterSection, state);
		
		// User-saved filter chips
		this.renderSavedFilterChips(filterSection, state, savedFilters);
		
		// Placeholder for save filter button (rendered after search input is created)
		const saveFilterPlaceholder = filterSection.createEl('div', { cls: 'kanban-save-filter-placeholder' });
		
		// Spacer pushes dropdowns to right
		filterSection.createEl('div', { cls: 'kanban-filter-spacer' });
		
		// Tag filter dropdown
		this.renderTagFilter(filterSection, state);
		
		// Date filter dropdown
		this.renderDateFilter(filterSection, state);
		
		// Secondary row: search, sort, and filter indicator
		const secondaryRow = toolbar.createEl('div', { cls: 'kanban-toolbar-secondary' });
		
		// Search input (rendered first so save button can reference it)
		this.renderSearchInput(secondaryRow, state.searchQuery);
		
		// Now render save filter button with access to search input
		this.renderSaveFilterButton(saveFilterPlaceholder, state);
		
		// Sort controls
		this.renderSortControls(secondaryRow, state);
		
		// Active filter count & clear button
		this.renderFilterIndicator(secondaryRow, state);
	}

	/**
	 * Render filter chips for quick type filtering
	 */
	private renderFilterChips(toolbar: HTMLElement, state: BoardState): void {
		const filtersContainer = toolbar.createEl('div', { cls: 'kanban-filters' });
		
		for (const filter of DEFAULT_SAVED_FILTERS) {
			const isActive = this.isFilterActive(filter, state);
			
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
			
			// Handle bookmark filter specially
			if (filter.isBookmarkFilter) {
				chip.onclick = async () => {
					await this.callbacks.onBookmarkFilterToggle(!state.showBookmarksOnly);
				};
			} else {
				chip.onclick = async () => {
					// Clear bookmark filter when selecting other filters
					if (state.showBookmarksOnly) {
						await this.callbacks.onBookmarkFilterToggle(false);
					}
					await this.callbacks.onTypeFilterChange(filter.typeFilters);
				};
			}
		}
	}

	/**
	 * Render user-saved filter chips
	 */
	private renderSavedFilterChips(container: HTMLElement, state: BoardState, savedFilters: SavedFilter[]): void {
		for (const filter of savedFilters) {
			if (filter.isDefault) continue; // Skip built-in filters
			
			const isActive = this.isSavedFilterActive(filter, state);
			
			const chip = container.createEl('button', {
				cls: `kanban-filter-chip kanban-filter-chip-saved ${isActive ? 'kanban-filter-chip-active' : ''}`,
				attr: { 'aria-label': `Saved filter: ${filter.name}` }
			});
			
			chip.createEl('span', { 
				cls: 'kanban-filter-chip-label',
				text: filter.name 
			});
			
			// Delete button (visible on hover)
			const deleteBtn = chip.createEl('span', { 
				cls: 'kanban-filter-chip-delete',
				attr: { 'aria-label': 'Delete filter' }
			});
			deleteBtn.innerHTML = Icons.close;
			deleteBtn.onclick = (e) => {
				e.stopPropagation();
				this.callbacks.onDeleteSavedFilter?.(filter.id);
			};
			
			chip.onclick = () => this.callbacks.onApplySavedFilter?.(filter);
		}
	}

	/**
	 * Render save filter button
	 */
	private renderSaveFilterButton(container: HTMLElement, state: BoardState): void {
		// Check initial filter state for styling
		const hasFilters = state.typeFilters.length > 0 || 
			state.tagFilters.length > 0 || 
			state.dateFilter || 
			state.showBookmarksOnly ||
			state.searchQuery;
		
		const saveBtn = container.createEl('button', {
			cls: `kanban-save-filter-btn ${hasFilters ? '' : 'kanban-save-filter-btn-disabled'}`,
			attr: { 
				'aria-label': 'Save current filters',
				'title': 'Save current filter'
			}
		});
		saveBtn.innerHTML = Icons.plus;
		
		// Always attach click handler - check current state when clicked
		// This allows saving search queries that were typed after initial render
		saveBtn.onclick = () => {
			// Check current search input value as well
			const currentSearchQuery = this.searchInputEl?.value || state.searchQuery;
			const currentHasFilters = state.typeFilters.length > 0 || 
				state.tagFilters.length > 0 || 
				state.dateFilter || 
				state.showBookmarksOnly ||
				currentSearchQuery;
			
			if (currentHasFilters) {
				this.callbacks.onSaveFilter?.();
			}
		};
		
		// Update button appearance when search input changes
		if (this.searchInputEl) {
			const updateButtonState = () => {
				const currentSearchQuery = this.searchInputEl?.value || '';
				const currentHasFilters = state.typeFilters.length > 0 || 
					state.tagFilters.length > 0 || 
					state.dateFilter || 
					state.showBookmarksOnly ||
					currentSearchQuery;
				
				if (currentHasFilters) {
					saveBtn.removeClass('kanban-save-filter-btn-disabled');
				} else {
					saveBtn.addClass('kanban-save-filter-btn-disabled');
				}
			};
			this.searchInputEl.addEventListener('input', updateButtonState);
		}
	}

	/**
	 * Check if a saved filter matches the current state
	 */
	private isSavedFilterActive(filter: SavedFilter, state: BoardState): boolean {
		const typeMatch = JSON.stringify((filter.typeFilters || []).sort()) === 
			JSON.stringify(state.typeFilters.sort());
		const tagMatch = JSON.stringify((filter.tagFilters || []).sort()) === 
			JSON.stringify(state.tagFilters.sort());
		const tagModeMatch = (filter.tagFilterMode || 'any') === state.tagFilterMode;
		const dateMatch = JSON.stringify(filter.dateFilter) === 
			JSON.stringify(state.dateFilter);
		const searchMatch = (filter.searchQuery || '') === state.searchQuery;
		
		return typeMatch && tagMatch && tagModeMatch && dateMatch && searchMatch;
	}

	/**
	 * Check if a filter matches the current state
	 */
	private isFilterActive(filter: SavedFilter, state: BoardState): boolean {
		// Bookmark filter
		if (filter.isBookmarkFilter) {
			return state.showBookmarksOnly;
		}
		
		// Don't show other filters as active when bookmarks filter is on
		if (state.showBookmarksOnly) {
			return false;
		}
		
		// "All" filter - active when no type filters AND no other filters
		if (filter.typeFilters.length === 0) {
			return state.typeFilters.length === 0 && 
				state.tagFilters.length === 0 && 
				!state.dateFilter &&
				!state.searchQuery;
		}
		
		// Regular type filters - must match exactly
		if (filter.typeFilters.length !== state.typeFilters.length) {
			return false;
		}
		return filter.typeFilters.every(t => state.typeFilters.includes(t));
	}

	/**
	 * Count active filters for indicator
	 */
	private countActiveFilters(state: BoardState): number {
		let count = 0;
		if (state.typeFilters.length > 0) count++;
		if (state.tagFilters.length > 0) count++;
		if (state.dateFilter) count++;
		if (state.showBookmarksOnly) count++;
		if (state.searchQuery) count++;
		return count;
	}

	/**
	 * Render filter indicator with count and clear button
	 */
	private renderFilterIndicator(toolbar: HTMLElement, state: BoardState): void {
		const activeCount = this.countActiveFilters(state);
		if (activeCount === 0) return;

		const indicator = toolbar.createEl('div', { cls: 'kanban-filter-indicator' });
		
		const badge = indicator.createEl('span', { 
			cls: 'kanban-filter-badge',
			text: `${activeCount} filter${activeCount > 1 ? 's' : ''}`
		});
		
		const clearBtn = indicator.createEl('button', {
			cls: 'kanban-filter-clear-btn',
			attr: { 'aria-label': 'Clear all filters' }
		});
		clearBtn.innerHTML = Icons.close;
		clearBtn.createEl('span', { text: 'Clear' });
		
		clearBtn.onclick = () => this.callbacks.onClearAllFilters();
	}

	/**
	 * Render tag filter dropdown
	 */
	private renderTagFilter(toolbar: HTMLElement, state: BoardState): void {
		const container = toolbar.createEl('div', { cls: 'kanban-tag-filter' });
		
		const hasActiveTagFilter = state.tagFilters.length > 0;
		
		const btn = container.createEl('button', {
			cls: `kanban-dropdown-btn ${hasActiveTagFilter ? 'kanban-dropdown-btn-active' : ''}`,
			attr: { 'aria-label': 'Filter by tags' }
		});
		
		const iconEl = btn.createEl('span', { cls: 'kanban-dropdown-icon' });
		iconEl.innerHTML = Icons.tag;
		btn.createEl('span', { text: 'Tags' });
		if (hasActiveTagFilter) {
			btn.createEl('span', { cls: 'kanban-dropdown-count', text: `(${state.tagFilters.length})` });
		}
		btn.createEl('span', { cls: 'kanban-dropdown-chevron' }).innerHTML = Icons.chevronDown;

		// Dropdown panel (hidden by default via inline style)
		const dropdown = container.createEl('div', { cls: 'kanban-dropdown-panel' });
		dropdown.style.display = 'none';
		
		// Mode toggle
		const modeContainer = dropdown.createEl('div', { cls: 'kanban-tag-mode' });
		modeContainer.createEl('span', { text: 'Match:' });
		
		const anyBtn = modeContainer.createEl('button', {
			cls: `kanban-mode-btn ${state.tagFilterMode === 'any' ? 'kanban-mode-btn-active' : ''}`,
			text: 'Any'
		});
		const allBtn = modeContainer.createEl('button', {
			cls: `kanban-mode-btn ${state.tagFilterMode === 'all' ? 'kanban-mode-btn-active' : ''}`,
			text: 'All'
		});
		
		anyBtn.onclick = (e) => {
			e.stopPropagation();
			this.keepDropdownOpen = 'tag';
			this.callbacks.onTagFilterChange(state.tagFilters, 'any');
		};
		allBtn.onclick = (e) => {
			e.stopPropagation();
			this.keepDropdownOpen = 'tag';
			this.callbacks.onTagFilterChange(state.tagFilters, 'all');
		};

		// Tag list
		const tagList = dropdown.createEl('div', { cls: 'kanban-tag-list' });
		
		if (this.availableTags.length === 0) {
			tagList.createEl('div', { cls: 'kanban-tag-empty', text: 'No tags found' });
		} else {
			for (const tag of this.availableTags) {
				const isSelected = state.tagFilters.includes(tag);
				const tagItem = tagList.createEl('div', {
					cls: `kanban-tag-item ${isSelected ? 'kanban-tag-item-selected' : ''}`
				});
				
				const checkbox = tagItem.createEl('span', { cls: 'kanban-tag-checkbox' });
				if (isSelected) {
					checkbox.innerHTML = Icons.check;
				}
				
				tagItem.createEl('span', { cls: 'kanban-tag-name', text: `#${tag}` });
				
				tagItem.onclick = (e) => {
					e.stopPropagation();
					this.keepDropdownOpen = 'tag';
					const newTags = isSelected
						? state.tagFilters.filter(t => t !== tag)
						: [...state.tagFilters, tag];
					this.callbacks.onTagFilterChange(newTags, state.tagFilterMode);
				};
			}
		}

		// Toggle dropdown
		btn.onclick = (e) => {
			e.stopPropagation();
			this.keepDropdownOpen = null; // Clear when manually toggling
			this.toggleDropdown(dropdown, container);
		};

		// If this dropdown should stay open after re-render, open it
		if (this.keepDropdownOpen === 'tag') {
			this.openDropdown(dropdown, container);
			this.keepDropdownOpen = null;
		}
	}

	/**
	 * Render date filter dropdown
	 */
	private renderDateFilter(toolbar: HTMLElement, state: BoardState): void {
		const container = toolbar.createEl('div', { cls: 'kanban-date-filter' });
		
		const hasActiveDateFilter = !!state.dateFilter;
		
		const btn = container.createEl('button', {
			cls: `kanban-dropdown-btn ${hasActiveDateFilter ? 'kanban-dropdown-btn-active' : ''}`,
			attr: { 'aria-label': 'Filter by date' }
		});
		
		const iconEl = btn.createEl('span', { cls: 'kanban-dropdown-icon' });
		iconEl.innerHTML = Icons.calendar;
		btn.createEl('span', { text: 'Date' });
		if (hasActiveDateFilter && state.dateFilter?.preset) {
			btn.createEl('span', { cls: 'kanban-dropdown-count', text: `(${this.getPresetLabel(state.dateFilter.preset)})` });
		}
		btn.createEl('span', { cls: 'kanban-dropdown-chevron' }).innerHTML = Icons.chevronDown;

		// Dropdown panel (hidden by default via inline style)
		const dropdown = container.createEl('div', { cls: 'kanban-dropdown-panel' });
		dropdown.style.display = 'none';
		
		// Field toggle (created vs modified)
		const fieldContainer = dropdown.createEl('div', { cls: 'kanban-date-field' });
		fieldContainer.createEl('span', { text: 'By:' });
		
		const currentField = state.dateFilter?.field || 'modified';
		
		const createdBtn = fieldContainer.createEl('button', {
			cls: `kanban-mode-btn ${currentField === 'created' ? 'kanban-mode-btn-active' : ''}`,
			text: 'Created'
		});
		const modifiedBtn = fieldContainer.createEl('button', {
			cls: `kanban-mode-btn ${currentField === 'modified' ? 'kanban-mode-btn-active' : ''}`,
			text: 'Modified'
		});
		
		createdBtn.onclick = (e) => {
			e.stopPropagation();
			if (state.dateFilter) {
				this.keepDropdownOpen = 'date';
				this.callbacks.onDateFilterChange({ ...state.dateFilter, field: 'created' });
			}
		};
		modifiedBtn.onclick = (e) => {
			e.stopPropagation();
			if (state.dateFilter) {
				this.keepDropdownOpen = 'date';
				this.callbacks.onDateFilterChange({ ...state.dateFilter, field: 'modified' });
			}
		};

		// Preset options
		const presets: { value: DatePreset; label: string }[] = [
			{ value: 'today', label: 'Today' },
			{ value: 'yesterday', label: 'Yesterday' },
			{ value: 'week', label: 'This Week' },
			{ value: 'month', label: 'This Month' },
			{ value: 'year', label: 'This Year' }
		];

		const presetList = dropdown.createEl('div', { cls: 'kanban-date-presets' });
		
		for (const preset of presets) {
			const isSelected = state.dateFilter?.preset === preset.value;
			const presetItem = presetList.createEl('div', {
				cls: `kanban-preset-item ${isSelected ? 'kanban-preset-item-selected' : ''}`
			});
			
			if (isSelected) {
				const check = presetItem.createEl('span', { cls: 'kanban-preset-check' });
				check.innerHTML = Icons.check;
			}
			
			presetItem.createEl('span', { text: preset.label });
			
			presetItem.onclick = (e) => {
				e.stopPropagation();
				if (isSelected) {
					// Clicking again clears the filter
					this.callbacks.onDateFilterChange(undefined);
				} else {
					this.callbacks.onDateFilterChange({
						field: currentField,
						preset: preset.value
					});
				}
				this.closeActiveDropdown();
			};
		}

		// Clear option
		if (hasActiveDateFilter) {
			const clearItem = presetList.createEl('div', { cls: 'kanban-preset-item kanban-preset-clear' });
			clearItem.createEl('span', { text: 'Clear date filter' });
			clearItem.onclick = (e) => {
				e.stopPropagation();
				this.callbacks.onDateFilterChange(undefined);
				this.closeActiveDropdown();
			};
		}

		// Toggle dropdown
		btn.onclick = (e) => {
			e.stopPropagation();
			this.keepDropdownOpen = null; // Clear when manually toggling
			this.toggleDropdown(dropdown, container);
		};

		// If this dropdown should stay open after re-render, open it
		if (this.keepDropdownOpen === 'date') {
			this.openDropdown(dropdown, container);
			this.keepDropdownOpen = null;
		}
	}

	/**
	 * Get human-readable label for date preset
	 */
	private getPresetLabel(preset: DatePreset): string {
		switch (preset) {
			case 'today': return 'Today';
			case 'yesterday': return 'Yesterday';
			case 'week': return 'Week';
			case 'month': return 'Month';
			case 'year': return 'Year';
			default: return preset;
		}
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

/**
 * Kanban 4000 - Navigator Core Types
 * Type mirrors for Navigator Core integration (when core types aren't directly importable)
 */

import { TFile, TFolder, WorkspaceLeaf } from 'obsidian';

// ============================================
// Navigator Core Type Mirrors
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

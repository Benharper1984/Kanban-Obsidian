# Core API Reference

Complete API documentation for the Vault Navigator Core plugin.

---

## NavigatorCore

The main entry point for view plugins. Access via `window.NavigatorCore`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `app` | `App` | Obsidian App instance |
| `manifest` | `PluginManifest` | Core plugin manifest |

### Methods

#### registerViewPlugin

Register a view plugin with the core.

```typescript
registerViewPlugin(plugin: NavigatorViewPlugin): void
```

**Parameters:**
- `plugin` - The view plugin to register

**Example:**
```typescript
const core = window.NavigatorCore;
core.registerViewPlugin(new MyViewPlugin());
```

---

#### unregisterViewPlugin

Unregister a view plugin.

```typescript
unregisterViewPlugin(pluginId: string): void
```

**Parameters:**
- `pluginId` - The ID of the plugin to unregister

**Example:**
```typescript
core.unregisterViewPlugin('myview');
```

---

#### getItems

Retrieve vault items with optional filtering and metadata.

```typescript
getItems(options?: GetItemsOptions): Promise<VaultItem[]>
```

**Parameters:**
```typescript
interface GetItemsOptions {
    path?: string;                    // Root path (default: '/')
    recursive?: boolean;              // Include nested items (default: false)
    includeMetadata?: MetadataType[]; // Which metadata to extract
    filters?: FilterState;            // Filter criteria
}

type MetadataType = 'geo' | 'dates' | 'links' | 'tags';
```

**Returns:** Array of `VaultItem` objects

**Example:**
```typescript
// Get all files with tags and links
const items = await core.getItems({
    includeMetadata: ['tags', 'links']
});

// Get files in specific folder with geo data
const geoItems = await core.getItems({
    path: 'Travel Notes',
    includeMetadata: ['geo'],
    filters: { fileTypes: ['md'] }
});
```

---

#### getItem

Retrieve a single vault item by path.

```typescript
getItem(path: string, options?: GetItemOptions): Promise<VaultItem | null>
```

**Parameters:**
- `path` - The vault path to the item
- `options` - Optional metadata options

**Returns:** `VaultItem` or `null` if not found

**Example:**
```typescript
const item = await core.getItem('Projects/MyProject.md', {
    includeMetadata: ['links', 'tags']
});
```

---

#### getSharedState

Get the current shared state.

```typescript
getSharedState(): ViewState
```

**Returns:** Current `ViewState` object

**Example:**
```typescript
const state = core.getSharedState();
console.log('Focused:', state.focusedItem);
console.log('Selected:', state.selectedItems);
```

---

#### updateSharedState

Update the shared state. All views will be notified.

```typescript
updateSharedState(partial: Partial<ViewState>): void
```

**Parameters:**
- `partial` - Partial state to merge

**Example:**
```typescript
// Focus an item
core.updateSharedState({ focusedItem: 'path/to/note.md' });

// Update filters
core.updateSharedState({
    filters: {
        ...core.getSharedState().filters,
        tags: ['important']
    }
});
```

---

#### navigateToItem

Navigate to an item, optionally in a specific view.

```typescript
navigateToItem(path: string, options?: NavigateOptions): Promise<void>
```

**Parameters:**
```typescript
interface NavigateOptions {
    viewId?: string;      // Switch to this view
    highlight?: boolean;  // Highlight the item (default: true)
    openFile?: boolean;   // Open file in editor (default: false)
}
```

**Example:**
```typescript
// Navigate and highlight in current view
await core.navigateToItem('Projects/Important.md');

// Switch to kanban and highlight
await core.navigateToItem('Projects/Important.md', {
    viewId: 'kanban',
    highlight: true
});
```

---

#### switchToView

Switch to a different view.

```typescript
switchToView(viewId: string): Promise<void>
```

**Parameters:**
- `viewId` - The ID of the view to switch to

**Example:**
```typescript
await core.switchToView('timeline');
await core.switchToView('map');
```

---

#### on / off

Subscribe to or unsubscribe from events.

```typescript
on(event: CoreEvent, callback: EventCallback): () => void
off(event: CoreEvent, callback: EventCallback): void
```

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `state-change` | `{ previous: ViewState, current: ViewState }` | Shared state changed |
| `view-change` | `{ from: string, to: string }` | Active view switched |
| `item-change` | `{ path: string, item: VaultItem }` | Item metadata changed |
| `items-refresh` | `{ paths: string[] }` | Multiple items need refresh |

**Example:**
```typescript
// Subscribe
const unsubscribe = core.on('state-change', (event) => {
    console.log('State changed:', event.current);
});

// Later: unsubscribe
unsubscribe();

// Alternative: manual unsubscribe
const handler = (event) => { /* ... */ };
core.on('view-change', handler);
core.off('view-change', handler);
```

---

#### getRegisteredViews

Get all registered view plugins.

```typescript
getRegisteredViews(): NavigatorViewPlugin[]
```

**Returns:** Array of registered view plugins

**Example:**
```typescript
const views = core.getRegisteredViews();
for (const view of views) {
    console.log(`${view.manifest.name} (${view.manifest.id})`);
}
```

---

## Interfaces

### VaultItem

Universal representation of a vault item.

```typescript
interface VaultItem {
    /** Full path in vault */
    path: string;
    
    /** Display name (filename without extension) */
    title: string;
    
    /** Item type */
    type: 'file' | 'folder' | 'link';
    
    /** Extracted metadata */
    metadata: ItemMetadata;
    
    /** Obsidian TFile reference (if file) */
    file?: TFile;
    
    /** Obsidian TFolder reference (if folder) */
    folder?: TFolder;
}
```

---

### ItemMetadata

Metadata extracted from a vault item.

```typescript
interface ItemMetadata {
    /** All tags (frontmatter + inline #tags) */
    tags: string[];
    
    /** Outgoing wiki-links */
    links: LinkInfo[];
    
    /** Incoming links (backlinks) */
    backlinks: LinkInfo[];
    
    /** File creation date */
    created: Date;
    
    /** Last modified date */
    modified: Date;
    
    /** Geographic location (if found) */
    geo?: GeoLocation;
    
    /** Date references in content */
    dates?: DateReference[];
    
    /** Raw frontmatter object */
    frontmatter: Record<string, unknown>;
}
```

---

### LinkInfo

Information about a link.

```typescript
interface LinkInfo {
    /** Target path or link text */
    target: string;
    
    /** Display text (alias) */
    displayText: string;
    
    /** Whether target exists in vault */
    resolved: boolean;
}
```

---

### GeoLocation

Geographic coordinates.

```typescript
interface GeoLocation {
    /** Latitude (-90 to 90) */
    lat: number;
    
    /** Longitude (-180 to 180) */
    lng: number;
    
    /** Optional location name */
    name?: string;
}
```

**Extraction Sources:**
- Frontmatter: `location: [lat, lng]` or `location: { lat: x, lng: y }`
- Frontmatter: `coordinates: [lat, lng]`
- Frontmatter: `geo: [lat, lng]`
- Content: `geo: 40.7128, -74.0060`
- Content: `coordinates: [40.7128, -74.0060]`

---

### DateReference

A date found in content.

```typescript
interface DateReference {
    /** The parsed date */
    date: Date;
    
    /** Text context around the date */
    context: string;
    
    /** Classification of the date */
    type: 'created' | 'modified' | 'mentioned' | 'deadline' | 'event';
}
```

**Extraction Sources:**
- Frontmatter: `date`, `created`, `modified`, `deadline`, `due`, `event`
- Content: ISO dates (YYYY-MM-DD)
- Content: Natural language (future enhancement)

---

### ViewState

Shared state across all views.

```typescript
interface ViewState {
    /** Currently focused item path */
    focusedItem?: string;
    
    /** Multi-selected item paths */
    selectedItems: string[];
    
    /** Active filters */
    filters: FilterState;
    
    /** View-specific state data */
    viewSpecific: Record<string, unknown>;
}
```

---

### FilterState

Filter criteria for items.

```typescript
interface FilterState {
    /** Search query */
    search: string;
    
    /** Required tags (AND logic) */
    tags: string[];
    
    /** Date range filter */
    dateRange?: {
        start: Date;
        end: Date;
    };
    
    /** Geographic bounds [south, west, north, east] */
    geoRegion?: {
        bounds: [number, number, number, number];
    };
    
    /** Filter by link presence */
    hasLinks?: boolean;
    
    /** File extension filter */
    fileTypes: string[];
}
```

---

### NavigatorViewPlugin

Interface that view plugins must implement.

```typescript
interface NavigatorViewPlugin {
    /** Plugin identity */
    manifest: ViewPluginManifest;
    
    /** Called when registered with core */
    onRegister(core: NavigatorCore): void;
    
    /** Called when unregistered */
    onUnregister(): void;
    
    /** Create a view instance */
    createView(leaf: WorkspaceLeaf): NavigatorView;
    
    /** Declare required metadata types */
    requiredMetadata(): ('geo' | 'dates' | 'links' | 'tags')[];
    
    /** Check if view can display an item */
    canDisplayItem(item: VaultItem): boolean;
    
    /** Get currently highlighted items */
    getHighlightedItems(): string[];
}

interface ViewPluginManifest {
    /** Unique identifier */
    id: string;
    
    /** Display name */
    name: string;
    
    /** Lucide icon name */
    icon: string;
    
    /** Short description */
    description: string;
}
```

---

### NavigatorView

Interface for view instances.

```typescript
interface NavigatorView {
    /** Render items with current state */
    render(items: VaultItem[], state: ViewState): void;
    
    /** Handle item selection */
    onItemSelect(path: string): void;
    
    /** Handle filter changes */
    onFilterChange(filters: FilterState): void;
    
    /** Get current view state */
    getState(): ViewState;
    
    /** Restore view state */
    setState(state: ViewState): void;
    
    /** Cleanup resources */
    cleanup(): void;
}
```

---

## CSS Variables

Core provides these CSS custom properties for consistent styling:

### Spacing

```css
--nav-spacing-xs: 4px;
--nav-spacing-sm: 8px;
--nav-spacing-md: 12px;
--nav-spacing-lg: 16px;
--nav-spacing-xl: 24px;
```

### Transitions

```css
--nav-transition-fast: 150ms ease;
--nav-transition-normal: 250ms ease;
--nav-transition-slow: 400ms ease;
--nav-view-transition: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Colors

```css
--nav-highlight-color: var(--interactive-accent);
--nav-selection-bg: var(--background-modifier-active-hover);
--nav-border-color: var(--background-modifier-border);
--nav-text-muted: var(--text-muted);
--nav-text-normal: var(--text-normal);
```

### Animation Classes

```css
.navigator-view-enter { /* View enter animation */ }
.navigator-view-exit { /* View exit animation */ }
.nav-item-highlight { /* Item highlight pulse */ }
```

---

## Error Handling

### Core Not Available

```typescript
const core = (window as any).NavigatorCore;
if (!core) {
    new Notice('Vault Navigator Core required');
    return;
}
```

### View Plugin Errors

Core catches and logs view plugin errors:

```typescript
// Errors are caught and logged
// Other views continue working
// User sees notice about failed view
```

### Item Not Found

```typescript
const item = await core.getItem('nonexistent.md');
if (!item) {
    console.log('Item not found');
}
```

---

## Performance Considerations

### Caching

- Core caches item metadata
- Cache invalidates on file change
- Use `includeMetadata` to limit extraction

### Large Vaults

- Use `filters` to limit results
- Use `path` to scope queries
- Avoid `recursive: true` on large folders

### Batch Operations

```typescript
// Good: Single call
const items = await core.getItems({
    path: 'Projects',
    includeMetadata: ['tags', 'links']
});

// Bad: Multiple calls
for (const path of paths) {
    const item = await core.getItem(path); // N calls
}
```

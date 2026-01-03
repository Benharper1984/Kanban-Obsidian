# Vault Navigator Architecture

## Vision

Transform the current Kanban 4000 plugin into a modular multi-view system for navigating Obsidian vaults. Users can seamlessly switch between different visualization modes:

- **Kanban Board** - Hierarchical folder/file navigation with drag-and-drop
- **Mind Map** - Graph-based visualization of links and connections
- **Geographic Map** - Spatial view of geotagged notes
- **Timeline** - Chronological view based on dates and timestamps

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Obsidian App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 vault-navigator-core                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │DataProvider │  │ViewRegistry │  │  StateManager   │   │  │
│  │  │  - Parsing  │  │  - Register │  │  - Shared State │   │  │
│  │  │  - Caching  │  │  - Discover │  │  - Sync Views   │   │  │
│  │  │  - Metadata │  │  - Switch   │  │  - Filters      │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │              Shared Components                       │ │  │
│  │  │  ContextMenu │ Toolbar │ SearchBar │ FilterPanel    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                   │
│              ▼               ▼               ▼                   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ kanban-view   │ │ timeline-view │ │   map-view    │         │
│  │    Plugin     │ │    Plugin     │ │    Plugin     │   ...   │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Plugin Responsibilities

### 1. Data Provider
- **Unified vault access** - Single API for reading files, folders, and metadata
- **Metadata extraction** - Parse frontmatter, tags, links, geo, dates
- **Caching layer** - Efficient caching with invalidation on file changes
- **Link resolution** - Resolve wiki-links and build backlink graphs

### 2. View Registry
- **Plugin registration** - View plugins register with the core
- **Discovery** - Core discovers available view plugins
- **Lifecycle management** - Initialize and cleanup view plugins
- **View switching** - Handle transitions between views

### 3. State Manager
- **Shared state** - Current selection, filters, focused item
- **State sync** - Keep all open views in sync
- **Persistence** - Save/restore state across sessions
- **Cross-view highlighting** - Select in one view, highlight in others

### 4. Shared Components
- **Context menus** - Right-click menus with common actions
- **Toolbar** - View switcher, search, filter controls
- **Search bar** - Universal search across vault
- **Filter panel** - Tag, date, location filters

## View Plugin Interface

Each view plugin implements the `NavigatorViewPlugin` interface:

```typescript
interface NavigatorViewPlugin {
    // Plugin identity
    manifest: {
        id: string;
        name: string;
        icon: string;
        description: string;
    };
    
    // Lifecycle
    onRegister(core: NavigatorCore): void;
    onUnregister(): void;
    
    // View creation
    createView(leaf: WorkspaceLeaf): NavigatorView;
    
    // Metadata requirements
    requiredMetadata(): ('geo' | 'dates' | 'links' | 'tags')[];
    
    // Capabilities
    canDisplayItem(item: VaultItem): boolean;
    getHighlightedItems(): string[];
}
```

## Data Model

### VaultItem
Universal representation of any vault item:

```typescript
interface VaultItem {
    path: string;           // Full path in vault
    title: string;          // Display name
    type: 'file' | 'folder' | 'link';
    metadata: ItemMetadata;
    file?: TFile;           // Obsidian file reference
    folder?: TFolder;       // Obsidian folder reference
}
```

### ItemMetadata
Extracted metadata for each item:

```typescript
interface ItemMetadata {
    tags: string[];              // All tags (frontmatter + inline)
    links: LinkInfo[];           // Outgoing links
    backlinks: LinkInfo[];       // Incoming links
    created: Date;               // File creation date
    modified: Date;              // Last modified date
    geo?: GeoLocation;           // Geographic coordinates
    dates?: DateReference[];     // Dates mentioned in content
    frontmatter: Record<string, unknown>;
}
```

### Metadata Types

```typescript
interface GeoLocation {
    lat: number;
    lng: number;
    name?: string;
}

interface DateReference {
    date: Date;
    context: string;
    type: 'created' | 'modified' | 'mentioned' | 'deadline' | 'event';
}

interface LinkInfo {
    target: string;
    displayText: string;
    resolved: boolean;
}
```

## View State Management

### Shared State
State that syncs across all views:

```typescript
interface ViewState {
    focusedItem?: string;        // Currently focused item path
    selectedItems: string[];      // Multi-selected items
    filters: FilterState;         // Active filters
    viewSpecific: Record<string, unknown>;  // View-specific data
}

interface FilterState {
    search: string;
    tags: string[];
    dateRange?: { start: Date; end: Date };
    geoRegion?: { bounds: [number, number, number, number] };
    hasLinks?: boolean;
    fileTypes: string[];
}
```

### State Flow
```
User Action in View A
        │
        ▼
View A calls core.updateSharedState()
        │
        ▼
Core broadcasts state to all views
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
    View A         View B         View C
  (updates)      (highlights)   (highlights)
```

## Plugin Communication

### Core API

```typescript
class NavigatorCore {
    // View plugin management
    registerViewPlugin(plugin: NavigatorViewPlugin): void;
    unregisterViewPlugin(pluginId: string): void;
    
    // Data access
    getItems(options?: GetItemsOptions): Promise<VaultItem[]>;
    getItem(path: string): Promise<VaultItem | null>;
    
    // State management
    getSharedState(): ViewState;
    updateSharedState(partial: Partial<ViewState>): void;
    
    // Navigation
    navigateToItem(path: string, options?: NavigateOptions): Promise<void>;
    switchToView(viewId: string): Promise<void>;
    
    // Events
    on(event: 'state-change' | 'view-change', callback: Function): void;
    off(event: string, callback: Function): void;
}
```

### Event System

| Event | Trigger | Payload |
|-------|---------|---------|
| `state-change` | Shared state updated | `{ previous: ViewState, current: ViewState }` |
| `view-change` | Active view switched | `{ from: string, to: string }` |
| `item-select` | Item selected in any view | `{ path: string, view: string }` |
| `filter-change` | Filters updated | `FilterState` |

## CSS Architecture

### Shared Variables
Core provides CSS custom properties for consistency:

```css
:root {
    /* Spacing */
    --nav-spacing-xs: 4px;
    --nav-spacing-sm: 8px;
    --nav-spacing-md: 12px;
    --nav-spacing-lg: 16px;
    --nav-spacing-xl: 24px;
    
    /* Transitions */
    --nav-transition-fast: 150ms ease;
    --nav-transition-normal: 250ms ease;
    --nav-transition-slow: 400ms ease;
    
    /* Colors (theme-aware) */
    --nav-highlight-color: var(--interactive-accent);
    --nav-selection-bg: var(--background-modifier-active-hover);
    --nav-border-color: var(--background-modifier-border);
}
```

### View Transitions
Smooth transitions when switching views:

```css
.navigator-view-enter {
    animation: navViewEnter 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.navigator-view-exit {
    animation: navViewExit 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

## File Structure

### Core Plugin
```
vault-navigator-core/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── core/
│   │   ├── DataProvider.ts     # Vault data access
│   │   ├── MetadataExtractor.ts
│   │   ├── CacheManager.ts
│   │   └── LinkResolver.ts
│   ├── registry/
│   │   ├── ViewRegistry.ts     # Plugin registration
│   │   ├── ViewSwitcher.ts
│   │   └── StateManager.ts
│   ├── components/
│   │   ├── ContextMenu.ts
│   │   ├── Toolbar.ts
│   │   ├── SearchBar.ts
│   │   └── FilterPanel.ts
│   └── types/
│       ├── index.ts
│       ├── VaultItem.ts
│       ├── ViewPlugin.ts
│       └── State.ts
├── styles/
│   ├── variables.css
│   ├── transitions.css
│   └── components.css
├── manifest.json
└── package.json
```

### View Plugin (e.g., Kanban)
```
vault-navigator-kanban/
├── src/
│   ├── main.ts                 # Plugin entry, registers with core
│   ├── KanbanViewPlugin.ts     # Implements NavigatorViewPlugin
│   ├── KanbanView.ts           # View rendering
│   ├── board/
│   │   ├── BoardBuilder.ts
│   │   ├── BoardRenderer.ts
│   │   └── DragDropHandler.ts
│   └── types.ts
├── styles/
│   └── kanban.css
├── manifest.json
└── package.json
```

## Dependency Management

### Core Plugin Dependencies
```json
{
    "dependencies": {
        "obsidian": "latest"
    }
}
```

### View Plugin Dependencies
```json
{
    "dependencies": {
        "obsidian": "latest"
    },
    "peerDependencies": {
        "vault-navigator-core": "^1.0.0"
    }
}
```

### Plugin Loading Order
1. Core plugin loads first
2. Core exposes global API: `window.NavigatorCore`
3. View plugins load and register via API
4. Core initializes registered views

## Error Handling

### Core Not Found
View plugins should handle missing core gracefully:

```typescript
class MyViewPlugin extends Plugin {
    async onload() {
        const core = (window as any).NavigatorCore;
        if (!core) {
            new Notice('Vault Navigator Core is required. Please install it first.');
            return;
        }
        core.registerViewPlugin(this.viewPlugin);
    }
}
```

### View Plugin Errors
Core isolates view plugin failures:

```typescript
async switchToView(viewId: string) {
    try {
        const plugin = this.registry.get(viewId);
        await plugin.createView(leaf);
    } catch (error) {
        console.error(`View plugin ${viewId} failed:`, error);
        new Notice(`Failed to load ${viewId} view`);
    }
}
```

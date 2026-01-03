# Migration Guide: Kanban 4000 → Vault Navigator

This guide outlines the step-by-step process to transition from the monolithic Kanban 4000 plugin to the modular Vault Navigator architecture.

## Migration Status

| Phase | Focus | Status | Completed |
|-------|-------|--------|-----------|
| Phase 1 | Core Foundation | ✅ Complete | Dec 2025 |
| Phase 2 | Kanban Extraction | ✅ Complete | Dec 2025 |
| Phase 3 | API Stabilization | ✅ Complete | Dec 2025 |
| Phase 4 | New Views | 🔄 In Progress | - |

---

## Phase 1: Core Foundation ✅

### 1.1 Create Core Plugin Structure ✅

Created the `vault-navigator-core` plugin alongside the existing Kanban plugin.

**Final Structure:**
```
.obsidian/plugins/
├── Kanban 4000/              # Refactored to use core
└── vault-navigator-core/      # New core plugin
    ├── src/
    │   ├── main.ts           # Plugin entry (246 lines)
    │   ├── types/            # Type definitions
    │   ├── core/             # DataProvider, MetadataExtractor, CacheManager
    │   ├── registry/         # ViewRegistry, StateManager
    │   └── views/            # NavigatorViewWrapper
    ├── styles/
    ├── manifest.json
    └── package.json
```

**Completed Tasks:**
- [x] Initialize new plugin with `manifest.json` and `package.json`
- [x] Set up TypeScript configuration
- [x] Create basic plugin entry point
- [x] Test plugin loads in Obsidian

### 1.2 Implement Data Provider ✅

**Implemented Files:**
- `src/core/DataProvider.ts` (221 lines) - Vault data access
- `src/core/MetadataExtractor.ts` (270 lines) - Tag/link/geo/date extraction
- `src/core/CacheManager.ts` (126 lines) - Efficient caching

**Completed Tasks:**
- [x] Define `VaultItem` and `ItemMetadata` interfaces
- [x] Implement basic file/folder traversal
- [x] Add tag extraction (from frontmatter + inline)
- [x] Add link extraction (wiki-links, embeds)
- [x] Add date extraction (frontmatter dates, ISO dates in content)
- [x] Add geo extraction (coordinates in frontmatter/content)
- [x] Implement caching layer
- [x] Add cache invalidation on file changes

### 1.3 Implement View Registry ✅

**Implemented Files:**
- `src/registry/ViewRegistry.ts` (120 lines) - Plugin registration

**Completed Tasks:**
- [x] Define `NavigatorViewPlugin` interface
- [x] Implement registration/unregistration
- [x] Add view type registration with Obsidian
- [x] Implement view switching logic
- [x] Add transition animations

### 1.4 Implement State Manager ✅

**Implemented Files:**
- `src/registry/StateManager.ts` (199 lines) - Shared state management

**Completed Tasks:**
- [x] Define `ViewState` and `FilterState` interfaces
- [x] Implement state storage
- [x] Add subscription system for views
- [x] Implement state persistence (localStorage)
- [x] Add filter state management

### 1.5 Extract Shared CSS ✅

**Implemented Files:**
- `styles/variables.css` - CSS custom properties
- `styles/transitions.css` - View animations
- `styles/components.css` - Shared component styles

---

## Phase 2: Kanban Extraction ✅

### 2.1 Create Kanban View Plugin ✅

Chose **Option B: Refactor in Place** for easier transition.

**New Integration Layer:**
```
Kanban 4000/src/core-integration/
├── index.ts                # Module exports
├── types.ts                # Bridge types (159 lines)
├── VaultItemAdapter.ts     # VaultItem ↔ KanbanCard (160 lines)
├── CoreBoardBuilder.ts     # Uses DataProvider (262 lines)
└── KanbanViewPlugin.ts     # NavigatorViewPlugin impl (221 lines)
```

**Completed Tasks:**
- [x] Create `KanbanViewPlugin` implementing `NavigatorViewPlugin`
- [x] Update `main.ts` to register with core
- [x] Add fallback if core not available

### 2.2 Adapt BoardBuilder ✅

Updated to use `VaultItem` from core via `CoreBoardBuilder`.

**Completed Tasks:**
- [x] Create `CoreBoardBuilder` to accept `VaultItem[]`
- [x] Use DataProvider when core available, fallback otherwise
- [x] Update card creation to use `ItemMetadata`
- [x] Preserve all existing functionality

### 2.3 Adapt KanbanView ✅

Updated `KanbanView.ts` to:
- [x] Use `CoreBoardBuilder` 
- [x] Subscribe to Navigator Core state changes
- [x] Support cross-view highlighting
- [x] Sync search/filters with core

### 2.4 Update Event Handlers ✅

- [x] Selection events notify core
- [x] Listen for state changes from core
- [x] File operations work with core's data model

### 2.5 Backward Compatibility ✅

- [x] Kanban works standalone if core not installed
- [x] No settings migration needed
- [x] No functionality regression

---

## Phase 3: API Stabilization ✅

### 3.1 API Review ✅

**Completed API Checklist:**
- [x] `NavigatorViewPlugin` interface is complete
- [x] `NavigatorView` interface covers all use cases
- [x] `VaultItem` has all needed metadata fields
- [x] State management handles all scenarios
- [x] CSS variables are comprehensive

### 3.2 Documentation ✅

**Created Documentation:**
- [x] `API_REFERENCE.md` - Complete API documentation (636 lines)
- [x] `VIEW_PLUGIN_GUIDE.md` - Developer guide (660 lines)
- [x] `EXAMPLE_PLUGIN_TEMPLATE.md` - Working example plugin
- [x] `CSS_CUSTOMIZATION_GUIDE.md` - Styling guide

### 3.3 Testing ✅

**Completed:**
- [x] Both plugins build successfully
- [x] Manual testing of Kanban integration
- [x] Cross-view highlighting works
- [x] State synchronization works
- [x] Backward compatibility verified

---

## Phase 4: New Views 🔄

Ready to implement additional views. See [ROADMAP.md](./ROADMAP.md) for planned views.

### 4.1 Timeline View (Planned)

**Priority:** High

**Required Metadata:** `dates`, `tags`

### 4.2 Mind Map View (Planned)

**Priority:** High

**Required Metadata:** `links`, `backlinks`

### 4.3 Geographic Map View (Planned)

**Priority:** Medium

**Required Metadata:** `geo`, `tags`

---

## Original Phase Documentation

<details>
<summary>Click to expand original Phase 1-3 task lists</summary>

### Original Phase 1: Core Foundation

**Tasks:**
- [ ] Initialize new plugin with `manifest.json` and `package.json`
- [ ] Set up TypeScript configuration
- [ ] Create basic plugin entry point
- [ ] Test plugin loads in Obsidian
```typescript
// src/registry/StateManager.ts
export class StateManager {
    getState(): ViewState
    updateState(partial: Partial<ViewState>): void
    subscribe(callback: (state: ViewState) => void): () => void
}
```

**Tasks:**
- [ ] Define `ViewState` and `FilterState` interfaces
- [ ] Implement state storage
- [ ] Add subscription system for views
- [ ] Implement state persistence (localStorage)
- [ ] Add filter state management

### 1.5 Extract Shared Components

Move reusable components to core.

**Source Files to Move:**
```
Kanban 4000/src/components/
├── ContextMenu.ts      → Core (generalize)
├── Icons.ts            → Core (keep as-is)
├── CreateItemModal.ts  → Keep in Kanban (specific)
└── ...
```

**Tasks:**
- [ ] Analyze each component for reusability
- [ ] Extract `ContextMenu` with plugin extension points
- [ ] Create shared `Toolbar` component
- [ ] Create `SearchBar` component
- [ ] Create `FilterPanel` component

### 1.6 Extract Shared CSS

Move shared styles to core.

**Source Files:**
```
Kanban 4000/styles/
├── variables.css  → Core (rename to nav-variables.css)
├── modals.css     → Core (shared modal styles)
└── ...            → Keep kanban-specific styles
```

**New Core Styles:**
```css
/* styles/variables.css */
:root {
    --nav-spacing-xs: 4px;
    --nav-spacing-sm: 8px;
    /* ... */
}

/* styles/components.css */
.nav-toolbar { }
.nav-search { }
.nav-filter-panel { }

/* styles/transitions.css */
.navigator-view-enter { }
.navigator-view-exit { }
```

**Tasks:**
- [ ] Create CSS custom property namespace (`--nav-*`)
- [ ] Extract shared component styles
- [ ] Create view transition animations
- [ ] Document CSS API for view plugins

---

## Phase 2: Kanban Extraction

### 2.1 Create Kanban View Plugin

Set up the Kanban plugin to depend on core.

**Option A: Separate Plugin (Recommended for clean architecture)**
```
vault-navigator-kanban/
├── src/
│   ├── main.ts
│   ├── KanbanViewPlugin.ts
│   └── ...
├── manifest.json
└── package.json
```

**Option B: Refactor in Place (Easier transition)**
```
Kanban 4000/
├── src/
│   ├── main.ts            # Modified to use core
│   ├── KanbanViewPlugin.ts # New: implements interface
│   └── ...
└── package.json           # Add peer dependency
```

**Tasks:**
- [ ] Decide on approach (A or B)
- [ ] Create `KanbanViewPlugin` implementing `NavigatorViewPlugin`
- [ ] Update `main.ts` to register with core
- [ ] Add fallback if core not available

### 2.2 Adapt BoardBuilder

Update to use `VaultItem` from core.

**Before:**
```typescript
// BoardBuilder.ts
interface KanbanList {
    name: string;
    path: string;
    cards: KanbanCard[];
}

async buildBoard(path: string): Promise<KanbanList[]> {
    const folder = this.app.vault.getAbstractFileByPath(path);
    // Direct vault access
}
```

**After:**
```typescript
// BoardBuilder.ts
import { VaultItem } from 'vault-navigator-core';

async buildBoard(items: VaultItem[]): Promise<KanbanList[]> {
    // Use pre-processed VaultItems from core
    const folders = items.filter(i => i.type === 'folder');
    const files = items.filter(i => i.type === 'file');
    // ...
}
```

**Tasks:**
- [ ] Update `BoardBuilder` to accept `VaultItem[]`
- [ ] Remove direct vault access (use core's DataProvider)
- [ ] Update card creation to use `ItemMetadata`
- [ ] Preserve all existing functionality

### 2.3 Adapt KanbanView

Update to implement `NavigatorView` interface.

**Before:**
```typescript
// KanbanView.ts
export class KanbanView extends ItemView {
    async onOpen() {
        // Full implementation
    }
}
```

**After:**
```typescript
// KanbanView.ts
import { NavigatorView, VaultItem, ViewState } from 'vault-navigator-core';

export class KanbanNavigatorView implements NavigatorView {
    render(items: VaultItem[], state: ViewState): void { }
    onItemSelect(path: string): void { }
    onFilterChange(filters: FilterState): void { }
    getState(): ViewState { }
    setState(state: ViewState): void { }
    cleanup(): void { }
}
```

**Tasks:**
- [ ] Implement `NavigatorView` interface
- [ ] Update render logic to use `VaultItem`
- [ ] Connect to core's state management
- [ ] Implement cross-view selection highlighting
- [ ] Update context menu to use core's system

### 2.4 Update Event Handlers

Connect to core's event system.

**Tasks:**
- [ ] Update selection events to notify core
- [ ] Listen for state changes from core
- [ ] Update drag-drop to work with core's data model
- [ ] Ensure file operations go through core

### 2.5 Preserve Backward Compatibility

Ensure existing users aren't broken.

**Tasks:**
- [ ] Kanban works standalone if core not installed
- [ ] Settings migration (if any)
- [ ] Document changes for users

---

## Phase 3: API Stabilization

### 3.1 API Review

Before adding more views, stabilize the core API.

**Review Checklist:**
- [ ] `NavigatorViewPlugin` interface is complete
- [ ] `NavigatorView` interface covers all use cases
- [ ] `VaultItem` has all needed metadata fields
- [ ] State management handles all scenarios
- [ ] CSS variables are comprehensive

### 3.2 Documentation

Create developer documentation.

**Tasks:**
- [ ] API reference documentation
- [ ] View plugin development guide
- [ ] Example plugin template
- [ ] CSS customization guide

### 3.3 Testing

Ensure stability before expansion.

**Tasks:**
- [ ] Unit tests for core components
- [ ] Integration tests for plugin registration
- [ ] Manual testing of Kanban integration
- [ ] Performance testing with large vaults

---

## Phase 4: New Views

### 4.1 Timeline View

**Priority:** High (dates are commonly used)

**Required Metadata:**
- `dates` - Extracted from frontmatter and content
- `tags` - For filtering

**Implementation Notes:**
- Use vis-timeline or custom implementation
- Support zooming (day/week/month/year)
- Cluster overlapping events

**Tasks:**
- [ ] Create `vault-navigator-timeline` plugin
- [ ] Implement date extraction in core (Phase 1)
- [ ] Design timeline UI
- [ ] Implement view plugin

### 4.2 Mind Map View

**Priority:** High (links are Obsidian's strength)

**Required Metadata:**
- `links` - Outgoing wiki-links
- `backlinks` - Incoming links

**Implementation Notes:**
- Use d3-force or cytoscape.js
- Interactive node positioning
- Collapse/expand clusters

**Tasks:**
- [ ] Create `vault-navigator-mindmap` plugin
- [ ] Implement link graph building in core
- [ ] Design force-directed layout
- [ ] Implement view plugin

### 4.3 Geographic Map View

**Priority:** Medium (niche but valuable)

**Required Metadata:**
- `geo` - Coordinates from frontmatter/content
- `tags` - For filtering

**Implementation Notes:**
- Use Leaflet.js
- Cluster markers at zoom levels
- Support multiple map tile providers

**Tasks:**
- [ ] Create `vault-navigator-map` plugin
- [ ] Implement geo extraction in core (Phase 1)
- [ ] Design map UI with clustering
- [ ] Implement view plugin

---

## Code Migration Examples

### Example 1: Type Migration

**Before (types.ts):**
```typescript
export interface KanbanCard {
    name: string;
    path: string;
    preview?: string;
    tags?: string[];
}
```

**After (using VaultItem):**
```typescript
import { VaultItem } from 'vault-navigator-core';

// VaultItem already has all this:
// - path, title (was name)
// - metadata.tags
// - Can add preview as viewSpecific data
```

### Example 2: Data Access Migration

**Before (BoardBuilder.ts):**
```typescript
async buildBoard(rootPath: string) {
    const folder = this.app.vault.getAbstractFileByPath(rootPath);
    if (!(folder instanceof TFolder)) return [];
    
    for (const child of folder.children) {
        if (child instanceof TFile) {
            const content = await this.app.vault.cachedRead(child);
            const cache = this.app.metadataCache.getFileCache(child);
            // Extract tags, links, etc.
        }
    }
}
```

**After:**
```typescript
async buildBoard(items: VaultItem[]) {
    // Items come pre-processed from core
    for (const item of items) {
        // Metadata already extracted
        const tags = item.metadata.tags;
        const links = item.metadata.links;
        // Just build the kanban structure
    }
}
```

### Example 3: State Management Migration

**Before:**
```typescript
class KanbanView extends ItemView {
    private selectedCard: string | null = null;
    
    selectCard(path: string) {
        this.selectedCard = path;
        this.render();
    }
}
```

**After:**
```typescript
class KanbanNavigatorView implements NavigatorView {
    constructor(private core: NavigatorCore) {}
    
    selectCard(path: string) {
        // Notify core, which syncs all views
        this.core.updateSharedState({ 
            focusedItem: path 
        });
    }
    
    // Called by core when state changes
    onStateChange(state: ViewState) {
        // Update highlighting
        this.highlightItem(state.focusedItem);
    }
}
```

---

## Risk Mitigation

### Breaking Changes
- **Risk:** Existing users lose functionality
- **Mitigation:** Kanban works standalone, core is optional enhancement

### Performance Regression
- **Risk:** Extra abstraction layer slows things down
- **Mitigation:** Efficient caching, lazy metadata loading

### API Instability
- **Risk:** View plugins break on core updates
- **Mitigation:** Semantic versioning, deprecation warnings

### Complexity
- **Risk:** Architecture becomes hard to maintain
- **Mitigation:** Clear boundaries, comprehensive docs, tests

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Core plugin loads in Obsidian
- [ ] DataProvider can list vault items with metadata
- [ ] ViewRegistry can register/unregister plugins
- [ ] StateManager syncs state across views
- [ ] Shared CSS variables work

### Phase 2 Complete When:
- [ ] Kanban uses core's DataProvider
- [ ] Kanban implements NavigatorView
- [ ] Selection syncs to core state
- [ ] Kanban works without core (fallback)
- [ ] No functionality regression

### Phase 3 Complete When:
- [ ] API documented
- [ ] Tests pass
- [ ] Performance acceptable
- [ ] Ready for community view plugins

### Phase 4 (Ongoing):
- [ ] Timeline view functional
- [ ] Mind map view functional
- [ ] Map view functional
- [ ] Community plugins emerging

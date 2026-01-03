# Mind Map View Specification

**Phase**: 4 - Modular Architecture Migration  
**Plugin ID**: `vault-navigator-mindmap`  
**Version**: 1.0.0

---

## Overview

The Mind Map View visualizes the Obsidian vault as an interactive node graph, where files are represented as nodes and links between files are represented as edges. This creates an intuitive way to explore the relationships and structure of your knowledge base.

## Key Features

### Core Visualization
- **Interactive Node Graph**: Files displayed as draggable nodes
- **Link Edges**: Bidirectional links visualized as connecting lines
- **Folder Clustering**: Optional grouping of nodes by folder or tag
- **Dynamic Layout**: Force-directed graph layout with collision detection

### Navigation & Interaction
- **Pan & Zoom**: Smooth canvas navigation with mouse/touch
- **Node Selection**: Click to select, highlight in other views
- **Multi-Select**: Shift+click or drag to select multiple nodes
- **Context Menu**: Right-click for file operations
- **Double-Click**: Open file in editor

### Cross-View Sync
- **Highlight Sync**: Selected items highlighted across all Navigator views
- **Focus Follow**: When item focused in other view, center on node
- **Filter Sync**: Shared tag/search filters affect visible nodes

### Clustering Modes
- **By Folder**: Group nodes by parent folder (default)
- **By Tag**: Group nodes by primary tag
- **By Link Density**: Cluster highly-connected nodes
- **None**: Free-form layout

---

## Technical Architecture

### Navigator Core Integration

```typescript
// Required metadata for graph construction
requiredMetadata(): MetadataType[] {
    return ['links', 'tags'];
}

// Can display files and folders
canDisplayItem(item: VaultItem): boolean {
    return item.type === 'file' || item.type === 'folder';
}
```

### File Structure

```
vault-navigator-mindmap/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
├── main.js (built)
└── src/
    ├── main.ts                    # Plugin entry point
    ├── MindMapViewPlugin.ts       # NavigatorViewPlugin implementation
    ├── MindMapView.ts             # NavigatorView implementation
    ├── core-integration/
    │   ├── index.ts
    │   └── types.ts               # Mirrored Navigator Core types
    ├── graph/
    │   ├── index.ts
    │   ├── GraphRenderer.ts       # Canvas/SVG rendering
    │   ├── ForceSimulation.ts     # Physics simulation
    │   ├── NodeRenderer.ts        # Individual node drawing
    │   └── EdgeRenderer.ts        # Link edge drawing
    ├── controls/
    │   ├── index.ts
    │   ├── PanZoomHandler.ts      # Pan/zoom controls
    │   ├── SelectionHandler.ts    # Node selection logic
    │   └── ClusteringHandler.ts   # Grouping logic
    └── components/
        ├── index.ts
        ├── Toolbar.ts             # View controls
        ├── MiniMap.ts             # Navigation minimap
        └── ContextMenu.ts         # Right-click menu
```

---

## Data Model

### Graph Node

```typescript
interface GraphNode {
    id: string;              // File path
    label: string;           // Display title
    type: 'file' | 'folder';
    x: number;               // Position
    y: number;
    vx: number;              // Velocity (for simulation)
    vy: number;
    radius: number;          // Node size
    color: string;           // Node color
    cluster?: string;        // Cluster ID (folder path or tag)
    metadata: {
        tags: string[];
        linkCount: number;
        backlinkCount: number;
    };
    isHighlighted: boolean;
    isSelected: boolean;
    isDragging: boolean;
}
```

### Graph Edge

```typescript
interface GraphEdge {
    id: string;              // Unique edge ID
    source: string;          // Source node path
    target: string;          // Target node path
    resolved: boolean;       // Link target exists
    bidirectional: boolean;  // Link goes both ways
    strength: number;        // Edge weight (multiple links = stronger)
}
```

### View State

```typescript
interface MindMapViewState {
    // Pan/zoom state
    transform: {
        x: number;
        y: number;
        scale: number;
    };
    
    // Clustering
    clusterMode: 'folder' | 'tag' | 'density' | 'none';
    expandedClusters: string[];
    
    // Display options
    showOrphans: boolean;      // Nodes with no links
    showFolders: boolean;      // Folder nodes
    showLabels: boolean;       // Node labels
    linkThreshold: number;     // Min links to show
    
    // Simulation
    simulationPaused: boolean;
}
```

---

## Rendering Pipeline

### 1. Data Transformation

```typescript
// Transform VaultItems to graph nodes/edges
function buildGraph(items: VaultItem[]): { nodes: GraphNode[], edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();
    
    // Create nodes from items
    for (const item of items) {
        const node = createNode(item);
        nodes.push(node);
        nodeMap.set(item.path, node);
    }
    
    // Create edges from links
    for (const item of items) {
        for (const link of item.metadata.links) {
            if (nodeMap.has(link.target)) {
                edges.push(createEdge(item.path, link.target, link));
            }
        }
    }
    
    return { nodes, edges };
}
```

### 2. Force Simulation

Using a D3-style force simulation for layout:

```typescript
// Forces applied to nodes
const forces = {
    // Repulsion between all nodes
    manyBody: forceManyBody().strength(-300),
    
    // Attraction along edges
    link: forceLink(edges).id(d => d.id).distance(100),
    
    // Keep nodes centered
    center: forceCenter(width / 2, height / 2),
    
    // Collision prevention
    collision: forceCollide().radius(d => d.radius + 10),
    
    // Cluster attraction (optional)
    cluster: forceCluster()
};
```

### 3. Canvas Rendering

```typescript
// Main render loop
function render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Apply pan/zoom transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // Draw edges first (behind nodes)
    for (const edge of edges) {
        drawEdge(ctx, edge);
    }
    
    // Draw nodes
    for (const node of nodes) {
        drawNode(ctx, node);
    }
    
    // Draw labels (if zoom level sufficient)
    if (transform.scale > 0.5) {
        for (const node of nodes) {
            drawLabel(ctx, node);
        }
    }
    
    ctx.restore();
}
```

---

## Interaction Handlers

### Pan & Zoom

```typescript
// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = clamp(transform.scale * delta, 0.1, 4);
    
    // Zoom toward cursor
    const mx = e.offsetX, my = e.offsetY;
    transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
    transform.y = my - (my - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;
});

// Pan with drag
canvas.addEventListener('mousedown', startPan);
canvas.addEventListener('mousemove', pan);
canvas.addEventListener('mouseup', endPan);
```

### Node Selection

```typescript
// Click to select
canvas.addEventListener('click', (e) => {
    const node = findNodeAt(e.offsetX, e.offsetY);
    
    if (node) {
        // Update shared state for cross-view sync
        core.updateSharedState({
            focusedItem: node.id,
            selectedItems: e.shiftKey 
                ? [...state.selectedItems, node.id]
                : [node.id]
        });
    }
});

// Double-click to open
canvas.addEventListener('dblclick', (e) => {
    const node = findNodeAt(e.offsetX, e.offsetY);
    if (node && node.type === 'file') {
        app.workspace.openLinkText(node.id, '');
    }
});
```

### Node Dragging

```typescript
// Drag individual nodes
let draggedNode: GraphNode | null = null;

canvas.addEventListener('mousedown', (e) => {
    const node = findNodeAt(e.offsetX, e.offsetY);
    if (node) {
        draggedNode = node;
        node.isDragging = true;
        // Fix node position during drag
        node.fx = node.x;
        node.fy = node.y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (draggedNode) {
        const [x, y] = screenToWorld(e.offsetX, e.offsetY);
        draggedNode.fx = x;
        draggedNode.fy = y;
    }
});

canvas.addEventListener('mouseup', () => {
    if (draggedNode) {
        draggedNode.isDragging = false;
        // Release node to simulation
        draggedNode.fx = null;
        draggedNode.fy = null;
        draggedNode = null;
    }
});
```

---

## Clustering Algorithm

### Folder-Based Clustering

```typescript
function clusterByFolder(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const clusters = new Map<string, GraphNode[]>();
    
    for (const node of nodes) {
        const folder = getParentFolder(node.id);
        if (!clusters.has(folder)) {
            clusters.set(folder, []);
        }
        clusters.get(folder)!.push(node);
        node.cluster = folder;
    }
    
    return clusters;
}
```

### Tag-Based Clustering

```typescript
function clusterByTag(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const clusters = new Map<string, GraphNode[]>();
    
    for (const node of nodes) {
        const primaryTag = node.metadata.tags[0] || 'untagged';
        if (!clusters.has(primaryTag)) {
            clusters.set(primaryTag, []);
        }
        clusters.get(primaryTag)!.push(node);
        node.cluster = primaryTag;
    }
    
    return clusters;
}
```

---

## Toolbar Controls

| Control | Icon | Description |
|---------|------|-------------|
| Zoom In | `zoom-in` | Increase zoom level |
| Zoom Out | `zoom-out` | Decrease zoom level |
| Fit View | `maximize` | Fit all nodes in view |
| Center | `crosshair` | Center on selected node |
| Cluster By | `folder`/`tag` | Toggle clustering mode |
| Show Orphans | `eye`/`eye-off` | Toggle orphan nodes |
| Pause Sim | `pause`/`play` | Pause physics simulation |
| Reset Layout | `refresh-cw` | Recalculate layout |

---

## CSS Custom Properties

```css
/* Node styling */
--mindmap-node-file: var(--interactive-accent);
--mindmap-node-folder: var(--text-accent);
--mindmap-node-orphan: var(--text-muted);
--mindmap-node-highlighted: var(--nav-highlight-color, #f0b400);
--mindmap-node-selected: var(--interactive-accent-hover);

/* Edge styling */
--mindmap-edge-color: var(--background-modifier-border);
--mindmap-edge-resolved: var(--text-muted);
--mindmap-edge-unresolved: var(--text-error);
--mindmap-edge-bidirectional: var(--interactive-accent);

/* Labels */
--mindmap-label-color: var(--text-normal);
--mindmap-label-bg: var(--background-primary);

/* Clusters */
--mindmap-cluster-bg: var(--background-secondary);
--mindmap-cluster-border: var(--background-modifier-border);

/* Animation */
--mindmap-transition-fast: var(--nav-transition-fast, 150ms);
--mindmap-transition-normal: var(--nav-transition-normal, 300ms);
```

---

## Performance Considerations

### Large Vaults (1000+ nodes)

1. **Viewport Culling**: Only render nodes visible in current viewport
2. **LOD Rendering**: Simplify nodes at low zoom levels
3. **Batch Updates**: Throttle re-renders to 60fps max
4. **Web Workers**: Move simulation to background thread
5. **Canvas vs SVG**: Use Canvas for >500 nodes

### Optimization Strategies

```typescript
// Viewport culling
function getVisibleNodes(nodes: GraphNode[], viewport: Rect): GraphNode[] {
    return nodes.filter(node => {
        const screenX = node.x * transform.scale + transform.x;
        const screenY = node.y * transform.scale + transform.y;
        return isInRect(screenX, screenY, viewport);
    });
}

// Throttled render
const render = throttle(() => {
    requestAnimationFrame(doRender);
}, 16); // ~60fps
```

---

## Standalone Mode

When Navigator Core is unavailable, the plugin operates in standalone mode:

```typescript
class MindMapView {
    private core: NavigatorCore | null;
    
    async loadItems(): Promise<VaultItem[]> {
        if (this.core) {
            // Use core's data provider
            return this.core.getItems({
                includeMetadata: ['links', 'tags']
            });
        } else {
            // Fallback: Build items from vault directly
            return this.buildItemsFromVault();
        }
    }
    
    private async buildItemsFromVault(): Promise<VaultItem[]> {
        const files = this.app.vault.getMarkdownFiles();
        return files.map(file => this.fileToVaultItem(file));
    }
}
```

---

## Accessibility

- **Keyboard Navigation**: Tab through nodes, Enter to select
- **ARIA Labels**: Announce node info on focus
- **High Contrast**: Respect OS high-contrast mode
- **Reduced Motion**: Skip animations when `prefers-reduced-motion`

---

## Future Enhancements

### Phase 4.1
- [ ] Time-based filtering (show links created in date range)
- [ ] Link type differentiation (wiki, embed, external)
- [ ] Search highlighting in graph

### Phase 4.2
- [ ] 3D view option (WebGL)
- [ ] Graph snapshots/bookmarks
- [ ] Export to PNG/SVG

### Phase 4.3
- [ ] AI-powered clustering suggestions
- [ ] Similarity-based edge detection
- [ ] Community detection algorithms

---

## Dependencies

```json
{
    "dependencies": {},
    "devDependencies": {
        "@types/node": "^16.11.6",
        "builtin-modules": "^3.3.0",
        "esbuild": "^0.17.3",
        "obsidian": "latest",
        "typescript": "^5.0.0"
    }
}
```

Note: No external runtime dependencies. Force simulation and rendering implemented from scratch for minimal bundle size.

---

## Testing Checklist

- [ ] Renders vault with <100 files
- [ ] Renders vault with 100-500 files  
- [ ] Renders vault with 500+ files
- [ ] Pan and zoom work smoothly
- [ ] Node selection syncs to other views
- [ ] Selection from other views highlights node
- [ ] Double-click opens file
- [ ] Context menu works
- [ ] Clustering modes switch correctly
- [ ] Works without Navigator Core (standalone)
- [ ] No memory leaks on view close

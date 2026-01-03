# Example Plugin Template

This is a complete, working example of a Vault Navigator view plugin. Use this as a starting point for your own views.

## File Structure

```
vault-navigator-example/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
└── src/
    ├── main.ts
    ├── ExampleViewPlugin.ts
    └── ExampleView.ts
```

---

## manifest.json

```json
{
    "id": "vault-navigator-example",
    "name": "Vault Navigator - Example View",
    "version": "1.0.0",
    "minAppVersion": "1.0.0",
    "description": "An example view plugin for Vault Navigator",
    "author": "Your Name",
    "authorUrl": "https://github.com/yourusername",
    "isDesktopOnly": false
}
```

---

## package.json

```json
{
    "name": "vault-navigator-example",
    "version": "1.0.0",
    "description": "Example Vault Navigator view plugin",
    "main": "main.js",
    "scripts": {
        "dev": "node esbuild.config.mjs",
        "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
    },
    "keywords": ["obsidian", "vault-navigator"],
    "devDependencies": {
        "@types/node": "^16.11.6",
        "builtin-modules": "^3.3.0",
        "esbuild": "^0.17.3",
        "obsidian": "latest",
        "typescript": "^5.0.0"
    }
}
```

---

## tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "node",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "declaration": true,
        "declarationMap": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"]
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}
```

---

## esbuild.config.mjs

```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins,
    ],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
```

---

## src/main.ts

```typescript
import { Plugin, Notice } from 'obsidian';
import { ExampleViewPlugin } from './ExampleViewPlugin';

// Type for Navigator Core (mirrors the interface)
interface NavigatorCore {
    registerViewPlugin(plugin: any): void;
    unregisterViewPlugin(pluginId: string): void;
}

// Declare global NavigatorCore
declare global {
    interface Window {
        NavigatorCore?: NavigatorCore;
    }
}

export default class ExampleNavigatorPlugin extends Plugin {
    private viewPlugin: ExampleViewPlugin | null = null;

    async onload() {
        console.log('Loading Example Navigator View');

        // Wait a moment for NavigatorCore to load
        await this.waitForCore();
        
        if (window.NavigatorCore) {
            this.registerWithCore(window.NavigatorCore);
        } else {
            new Notice(
                'Vault Navigator Core not found. ' +
                'Install it for full functionality.'
            );
            // Plugin can still work in standalone mode
        }
    }

    async onunload() {
        if (window.NavigatorCore && this.viewPlugin) {
            window.NavigatorCore.unregisterViewPlugin(
                this.viewPlugin.manifest.id
            );
        }
    }

    private async waitForCore(): Promise<void> {
        // Give core time to load if we loaded first
        return new Promise(resolve => {
            if (window.NavigatorCore) {
                resolve();
                return;
            }
            
            // Try again after a short delay
            setTimeout(() => resolve(), 500);
        });
    }

    private registerWithCore(core: NavigatorCore): void {
        this.viewPlugin = new ExampleViewPlugin(this);
        core.registerViewPlugin(this.viewPlugin);
        console.log('Example View registered with Navigator Core');
    }
}
```

---

## src/ExampleViewPlugin.ts

```typescript
import { WorkspaceLeaf } from 'obsidian';
import { ExampleView } from './ExampleView';
import ExampleNavigatorPlugin from './main';

// Type definitions (mirror Navigator Core types)
interface VaultItem {
    path: string;
    title: string;
    type: 'file' | 'folder' | 'link';
    metadata: {
        tags: string[];
        links: any[];
        backlinks: any[];
        created: Date;
        modified: Date;
        frontmatter: Record<string, unknown>;
        preview?: string;
    };
    file?: any;
    folder?: any;
}

interface ViewState {
    focusedItem?: string;
    selectedItems: string[];
    filters: FilterState;
    viewSpecific: Record<string, unknown>;
}

interface FilterState {
    search: string;
    tags: string[];
    fileTypes: string[];
}

interface NavigatorCore {
    getItems(options?: any): Promise<VaultItem[]>;
    getSharedState(): ViewState;
    updateSharedState(partial: Partial<ViewState>): void;
    on(event: string, callback: Function): () => void;
}

interface NavigatorViewPlugin {
    manifest: {
        id: string;
        name: string;
        icon: string;
        description: string;
    };
    onRegister(core: NavigatorCore): void;
    onUnregister(): void;
    createView(leaf: WorkspaceLeaf): any;
    requiredMetadata(): string[];
    canDisplayItem(item: VaultItem): boolean;
    getHighlightedItems(): string[];
}

/**
 * Example View Plugin Implementation
 */
export class ExampleViewPlugin implements NavigatorViewPlugin {
    manifest = {
        id: 'example',
        name: 'Example View',
        icon: 'layout-grid',
        description: 'An example view showing vault items in a grid'
    };

    private plugin: ExampleNavigatorPlugin;
    private core: NavigatorCore | null = null;
    private highlightedItems: string[] = [];

    constructor(plugin: ExampleNavigatorPlugin) {
        this.plugin = plugin;
    }

    onRegister(core: NavigatorCore): void {
        this.core = core;
        
        // Subscribe to state changes for cross-view sync
        core.on('state-change', (payload: { current: ViewState }) => {
            const { current } = payload;
            if (current.focusedItem) {
                this.highlightedItems = [
                    current.focusedItem,
                    ...current.selectedItems
                ];
            } else {
                this.highlightedItems = [...current.selectedItems];
            }
        });
    }

    onUnregister(): void {
        this.core = null;
        this.highlightedItems = [];
    }

    createView(leaf: WorkspaceLeaf): any {
        return new ExampleView(leaf, this.plugin, this.core);
    }

    requiredMetadata(): string[] {
        // Request tags and preview for our grid view
        return ['tags'];
    }

    canDisplayItem(item: VaultItem): boolean {
        // We can display any file or folder
        return item.type === 'file' || item.type === 'folder';
    }

    getHighlightedItems(): string[] {
        return this.highlightedItems;
    }

    getCore(): NavigatorCore | null {
        return this.core;
    }
}
```

---

## src/ExampleView.ts

```typescript
import { WorkspaceLeaf } from 'obsidian';
import ExampleNavigatorPlugin from './main';

// Type definitions (simplified for example)
interface VaultItem {
    path: string;
    title: string;
    type: 'file' | 'folder' | 'link';
    metadata: {
        tags: string[];
        preview?: string;
    };
}

interface ViewState {
    focusedItem?: string;
    selectedItems: string[];
    filters: { search: string; tags: string[]; fileTypes: string[] };
    viewSpecific: Record<string, unknown>;
}

interface FilterState {
    search: string;
    tags: string[];
    fileTypes: string[];
}

interface NavigatorCore {
    getItems(options?: any): Promise<VaultItem[]>;
    getSharedState(): ViewState;
    updateSharedState(partial: Partial<ViewState>): void;
}

/**
 * Example Navigator View Implementation
 */
export class ExampleView {
    private container: HTMLElement;
    private items: VaultItem[] = [];
    private currentState: ViewState | null = null;

    constructor(
        private leaf: WorkspaceLeaf,
        private plugin: ExampleNavigatorPlugin,
        private core: NavigatorCore | null
    ) {}

    /**
     * Main render method - called by Navigator Core
     */
    render(items: VaultItem[], state: ViewState): void {
        this.items = items;
        this.currentState = state;
        
        // Get container from leaf
        const containerEl = (this.leaf as any).containerEl;
        this.container = containerEl.children[1] as HTMLElement;
        this.container.empty();
        this.container.addClass('example-view-container');
        
        // Render header
        this.renderHeader();
        
        // Render grid
        this.renderGrid(items, state);
    }

    private renderHeader(): void {
        const header = this.container.createEl('div', {
            cls: 'example-view-header'
        });
        
        header.createEl('h2', { text: 'Example Grid View' });
        
        const count = this.container.createEl('span', {
            cls: 'example-view-count',
            text: `${this.items.length} items`
        });
    }

    private renderGrid(items: VaultItem[], state: ViewState): void {
        const grid = this.container.createEl('div', {
            cls: 'example-view-grid'
        });
        
        for (const item of items) {
            this.renderCard(grid, item, state);
        }
    }

    private renderCard(
        container: HTMLElement, 
        item: VaultItem, 
        state: ViewState
    ): void {
        const card = container.createEl('div', {
            cls: 'example-view-card',
            attr: { 'data-path': item.path }
        });
        
        // Highlight if focused
        if (state.focusedItem === item.path) {
            card.addClass('example-view-card-highlighted');
        }
        
        // Select if in selection
        if (state.selectedItems.includes(item.path)) {
            card.addClass('example-view-card-selected');
        }
        
        // Icon
        const icon = card.createEl('div', { cls: 'example-view-card-icon' });
        icon.innerHTML = item.type === 'folder' 
            ? '📁' 
            : item.type === 'file' ? '📄' : '🔗';
        
        // Title
        card.createEl('div', {
            cls: 'example-view-card-title',
            text: item.title
        });
        
        // Tags
        if (item.metadata.tags.length > 0) {
            const tags = card.createEl('div', { cls: 'example-view-card-tags' });
            for (const tag of item.metadata.tags.slice(0, 3)) {
                tags.createEl('span', {
                    cls: 'example-view-tag',
                    text: `#${tag}`
                });
            }
        }
        
        // Click handler
        card.addEventListener('click', () => {
            this.onItemSelect(item.path);
        });
    }

    /**
     * Handle item selection
     */
    onItemSelect(path: string): void {
        if (this.core) {
            this.core.updateSharedState({
                focusedItem: path,
                selectedItems: [path]
            });
        }
    }

    /**
     * Handle filter changes
     */
    onFilterChange(filters: FilterState): void {
        // Views can respond to filter changes
        // Core will typically handle re-fetching data
    }

    /**
     * Get current state
     */
    getState(): ViewState {
        return this.currentState || {
            focusedItem: undefined,
            selectedItems: [],
            filters: { search: '', tags: [], fileTypes: [] },
            viewSpecific: {}
        };
    }

    /**
     * Restore state
     */
    setState(state: ViewState): void {
        this.currentState = state;
    }

    /**
     * Cleanup when view closes
     */
    cleanup(): void {
        if (this.container) {
            this.container.empty();
        }
    }

    /**
     * Handle shared state changes
     */
    onSharedStateChange(state: ViewState): void {
        // Update highlighting when shared state changes
        this.updateHighlighting(state);
    }

    private updateHighlighting(state: ViewState): void {
        if (!this.container) return;
        
        // Remove existing highlights
        this.container.querySelectorAll('.example-view-card-highlighted')
            .forEach(el => el.removeClass('example-view-card-highlighted'));
        this.container.querySelectorAll('.example-view-card-selected')
            .forEach(el => el.removeClass('example-view-card-selected'));
        
        // Add highlight to focused item
        if (state.focusedItem) {
            const card = this.container.querySelector(
                `[data-path="${state.focusedItem}"]`
            );
            if (card) {
                card.addClass('example-view-card-highlighted');
            }
        }
        
        // Add selection styling
        for (const path of state.selectedItems) {
            const card = this.container.querySelector(`[data-path="${path}"]`);
            if (card) {
                card.addClass('example-view-card-selected');
            }
        }
    }
}
```

---

## styles.css

```css
/* Example View Styles */

.example-view-container {
    padding: var(--nav-spacing-md, 12px);
    height: 100%;
    overflow-y: auto;
}

.example-view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--nav-spacing-lg, 16px);
    padding-bottom: var(--nav-spacing-md, 12px);
    border-bottom: 1px solid var(--background-modifier-border);
}

.example-view-header h2 {
    margin: 0;
    font-size: 1.2em;
}

.example-view-count {
    color: var(--text-muted);
    font-size: 0.9em;
}

/* Grid Layout */
.example-view-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--nav-spacing-md, 12px);
}

/* Card Styles */
.example-view-card {
    display: flex;
    flex-direction: column;
    padding: var(--nav-spacing-md, 12px);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--nav-radius-md, 8px);
    cursor: pointer;
    transition: all var(--nav-transition-fast, 150ms ease);
}

.example-view-card:hover {
    background: var(--background-primary-alt);
    border-color: var(--background-modifier-border-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Highlighted Card (cross-view focus) */
.example-view-card-highlighted {
    border-color: var(--interactive-accent) !important;
    box-shadow: 0 0 0 2px var(--interactive-accent),
                0 4px 12px rgba(0, 0, 0, 0.15);
    animation: highlight-pulse 1.5s ease-in-out;
}

/* Selected Card (multi-select) */
.example-view-card-selected {
    background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.1);
    border-color: var(--interactive-accent);
}

/* Card Icon */
.example-view-card-icon {
    font-size: 2em;
    margin-bottom: var(--nav-spacing-sm, 8px);
}

/* Card Title */
.example-view-card-title {
    font-weight: 500;
    margin-bottom: var(--nav-spacing-sm, 8px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Tags */
.example-view-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nav-spacing-xs, 4px);
}

.example-view-tag {
    font-size: 0.75em;
    padding: 2px 6px;
    background: var(--background-modifier-hover);
    border-radius: var(--nav-radius-sm, 4px);
    color: var(--text-muted);
}

/* Highlight Animation */
@keyframes highlight-pulse {
    0%, 100% {
        box-shadow: 0 0 0 2px var(--interactive-accent),
                    0 4px 12px rgba(0, 0, 0, 0.15);
    }
    50% {
        box-shadow: 0 0 0 4px var(--interactive-accent),
                    0 4px 16px rgba(0, 0, 0, 0.2);
    }
}
```

---

## Usage

1. Copy this template to a new folder
2. Run `npm install`
3. Run `npm run build`
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/vault-navigator-example/` folder
5. Enable the plugin in Obsidian settings
6. The view will appear in Navigator Core's view menu

---

## Next Steps

- Add more metadata display (dates, links)
- Implement filtering UI
- Add drag-and-drop support
- Add context menus
- Add keyboard navigation

See the [View Plugin Development Guide](./VIEW_PLUGIN_GUIDE.md) for detailed documentation.

# Vault Navigator - Copilot Instructions

## Project Overview
Obsidian plugin ecosystem: **Navigator Core** (shared services) + **view plugins** (Kanban, Timeline, MindMap, Map).

## Architecture
- **Navigator Core**: DataProvider, ViewRegistry, StateManager, MetadataExtractor
- **View Plugins**: Implement `NavigatorViewPlugin` interface, register with core via `window.NavigatorCore`
- **Graceful Fallback**: Views work standalone if core unavailable

## Key Interfaces

```typescript
interface NavigatorViewPlugin {
  manifest: { id: string; name: string; icon: string; description: string };
  onRegister(core: NavigatorCore): void;
  onUnregister(): void;
  createView(leaf: WorkspaceLeaf): NavigatorView;
  requiredMetadata(): ('geo' | 'dates' | 'links' | 'tags')[];
  canDisplayItem(item: VaultItem): boolean;
  getHighlightedItems(): string[];
}

interface NavigatorView {
  render(items: VaultItem[], state: ViewState): void;
  onItemSelect(path: string): void;
  onFilterChange(filters: FilterState): void;
  getState(): ViewState;
  setState(state: ViewState): void;
  cleanup(): void;
}
```

## Conventions
- TypeScript strict mode, ES6 target
- Use Obsidian API (`TFile`, `TFolder`, `WorkspaceLeaf`, `Menu`)
- CSS variables: `--nav-spacing-*`, `--nav-transition-*`, `--nav-highlight-color`
- Cross-view sync via `core.updateSharedState()` and `core.on('state-change')`

## File Structure
```
src/
  main.ts              # Plugin entry, core registration
  *View.ts             # Main view class
  core-integration/    # Bridge types & adapters
styles/                # CSS modules
docs/
  core/                # Navigator Core API docs
  views/               # View specifications
```

## When Building New Views
1. Implement `NavigatorViewPlugin` + `NavigatorView` interfaces
2. Mirror core types locally in `core-integration/types.ts`
3. Use `VaultItemAdapter` pattern for type conversion
4. Support both core-connected and standalone modes

Try to keep files under ~300 lines for maintainability.
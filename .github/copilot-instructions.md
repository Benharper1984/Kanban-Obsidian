# Kanban 4000 - Copilot Instructions

> **⚠️ KEEP THIS FILE UPDATED**: When architecture changes (new files, renamed modules, changed patterns), update this document to prevent stale instructions.

---

## Project Overview

**Kanban 4000** is an Obsidian plugin that renders vault folder structures as navigable kanban boards. Part of the Navigator ecosystem (shared core + view plugins).

---

## Architecture

### Plugin Structure
```
src/
├── main.ts              # Plugin entry point, commands, ribbon icons
├── KanbanView.ts        # Main view class, state management, lifecycle
├── BookmarkService.ts   # Obsidian bookmarks integration
├── settings.ts          # Settings tab UI
├── types.ts             # All TypeScript interfaces and types
├── board/
│   ├── BoardBuilder.ts       # File-to-card conversion, sorting
│   ├── BoardRenderer.ts      # DOM rendering for board/lists/cards
│   ├── CardActionHandler.ts  # Click actions, modal triggers
│   ├── DragDropHandler.ts    # Drag & drop file moving
│   └── ToolbarRenderer.ts    # Header, search, filters, dropdowns
├── components/
│   ├── ContextMenu.ts        # Right-click menus
│   ├── CreateItemModal.ts    # New file/folder modal
│   ├── EmbeddedKanbanViewer.ts # Embedded kanban boards
│   ├── Icons.ts              # SVG icon definitions
│   ├── ImagePreviewModal.ts  # Image lightbox
│   └── MarkdownEditorModal.ts # Markdown edit modal
└── core-integration/
    ├── CoreBoardBuilder.ts   # Filtering (tags, dates, type)
    ├── CoreStateSync.ts      # State sync utilities
    ├── KanbanViewPlugin.ts   # Navigator Core interface
    ├── VaultItemAdapter.ts   # Type adapters
    └── types.ts              # Core integration types

styles/                   # CSS source files (see CSS section)
```

### Key Patterns
- **State-Driven Rendering**: `BoardState` in `types.ts` → state changes trigger re-renders
- **Callback Communication**: Child components use callbacks passed from `KanbanView`
- **Filter Pipeline**: Type → Tags → Date filters applied sequentially in `CoreBoardBuilder`
- **Graceful Fallback**: Works standalone if Navigator Core unavailable

---

## 🚫 Avoiding Duplicate Code

### Before Adding New Code
1. **Search first**: Use semantic search or grep to find existing implementations
2. **Check these files for existing utilities**:
   - `src/types.ts` - Type definitions, utility functions
   - `src/components/Icons.ts` - All SVG icons
   - `src/core-integration/CoreBoardBuilder.ts` - Filter/sort logic
   - `src/board/ToolbarRenderer.ts` - UI controls, dropdowns
3. **Reuse patterns**: Look at existing similar code before creating new

### Common Duplicates to Avoid
| Need | Existing Location |
|------|-------------------|
| SVG icons | `components/Icons.ts` - add to `ICONS` object |
| Filter logic | `CoreBoardBuilder.ts` - add filter method |
| Modal dialogs | Extend existing modal classes in `components/` |
| Dropdown UI | Follow pattern in `ToolbarRenderer.ts` |
| Type definitions | Add to `types.ts`, not inline |

### When Creating New Files
- Only create if functionality doesn't fit existing modules
- Consider if it should be a method in an existing class instead
- Export from appropriate `index.ts` barrel file

---

## 🎨 CSS Implementation

### Critical: CSS Build Pipeline
**Obsidian only loads `styles.css` from the plugin root.** All CSS must go through the build.

```
styles/*.css  →  (esbuild concatenates)  →  styles.css
```

### CSS File Organization
| File | Purpose |
|------|---------|
| `variables.css` | CSS custom properties (loaded first) |
| `base.css` | Container, scrollbar, base layout |
| `header.css` | Toolbar, breadcrumbs, filter dropdowns |
| `board.css` | Board grid, list columns |
| `cards.css` | Card styles, type variants |
| `bookmarks.css` | Bookmark-specific styles |
| `modals.css` | Modal dialogs |
| `embedded.css` | Embedded kanban viewer |
| `responsive.css` | Media queries (loaded last) |

### CSS Rules
1. **Never edit `styles.css` directly** - it's auto-generated
2. **Add CSS to appropriate file** in `styles/` folder
3. **Use existing CSS variables** from `variables.css`:
   ```css
   /* Use these, don't hardcode values */
   var(--kanban-spacing-sm)
   var(--kanban-card-radius)
   var(--kanban-transition-fast)
   var(--kanban-z-dropdown)
   ```
4. **Dropdown visibility**: Use inline `style.display` in JS, not CSS classes (avoids caching issues)
5. **Run build after CSS changes**: `npm run build`

### CSS Class Naming
- Prefix all classes with `kanban-`
- Use BEM-like naming: `kanban-card`, `kanban-card-title`, `kanban-card--folder`

---

## 📏 File Size Management

### Target: ~300 lines per file

### When Files Get Too Large
1. **Extract focused modules**: Split by single responsibility
2. **Create barrel exports**: Use `index.ts` files for clean imports
3. **Move types to `types.ts`**: Keep interfaces centralized

### Current Large Files to Watch
| File | Lines | Action if grows |
|------|-------|-----------------|
| `ToolbarRenderer.ts` | ~400 | Extract dropdown logic to `FilterDropdowns.ts` |
| `CoreBoardBuilder.ts` | ~350 | Extract filter methods to `FilterEngine.ts` |
| `KanbanView.ts` | ~350 | Extract state management to `BoardStateManager.ts` |

### Refactoring Triggers
- File exceeds 400 lines → consider splitting
- Function exceeds 50 lines → extract helper functions
- Similar code in 3+ places → extract to utility

---

## TypeScript Conventions

- **Strict mode enabled** - no `any` types without justification
- **ES6 target** - use modern syntax
- **Obsidian API types**: `TFile`, `TFolder`, `WorkspaceLeaf`, `Menu`, `Modal`
- **Interfaces in `types.ts`** - export from there, import elsewhere

### State Interface (for reference)
```typescript
interface BoardState {
  rootPath: string;
  currentPath: string;
  searchQuery: string;
  sortBy: SortOption;
  sortDirection: 'asc' | 'desc';
  activeFilter: FilterOption;
  tagFilters: string[];
  tagFilterMode: 'any' | 'all';
  dateFilter?: DateFilter;
  navigationHistory: string[];
}
```

---

## Navigator Core Integration

When core is available (`window.NavigatorCore`):
- Register via `KanbanViewPlugin` implementing `NavigatorViewPlugin`
- Use `VaultItemAdapter` for type conversion
- Sync state with `core.updateSharedState()`

When core unavailable:
- Plugin works standalone using direct Obsidian API
- All features remain functional

---

## Quick Reference

### Build Commands
```bash
npm run build    # Production build (JS + CSS)
npm run dev      # Watch mode for development
```

### Adding a New Feature Checklist
1. [ ] Search for existing similar code
2. [ ] Add types to `types.ts`
3. [ ] Add icons to `Icons.ts` (if needed)
4. [ ] Add CSS to appropriate `styles/*.css` file
5. [ ] Implement in smallest appropriate module
6. [ ] Wire callbacks through `KanbanView.ts`
7. [ ] Update this file if architecture changed

---

*Last updated: January 2026*
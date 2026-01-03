# Vault Navigator Roadmap

## Project Vision

Create a unified, modular ecosystem for navigating Obsidian vaults through multiple visualization paradigms. Users install a lightweight core and add only the views they need.

---

## Current Status

```
December 2025             Q1 2026                    Q2 2026
┌─────────────────────────┬──────────────────────────┬──────────────────────────┐
│ ✅ v0.1 - Core Complete │ 🔄 v0.5 - New Views      │ v1.0 - Stable Release    │
│ • DataProvider ✓        │ • Timeline view          │ • Production ready       │
│ • ViewRegistry ✓        │ • Mind Map view          │ • Community plugins      │
│ • StateManager ✓        │ • Performance tuning     │ • Plugin marketplace     │
│ • Kanban integrated ✓   │ • API refinements        │                          │
│ • API docs complete ✓   │                          │                          │
└─────────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## Milestone 1: Core Foundation (v0.1) ✅ COMPLETE

**Completed:** December 2025  
**Status:** ✅ Complete

### Goals
- [x] Core plugin structure
- [x] DataProvider with basic metadata extraction
- [x] ViewRegistry with plugin registration
- [x] StateManager for cross-view sync
- [x] Kanban works as first view plugin
- [x] Complete API documentation
- [x] Example plugin template

### Deliverables

| Component | Description | Status |
|-----------|-------------|--------|
| `DataProvider` | File/folder traversal, caching | ✅ Complete |
| `ViewRegistry` | Plugin registration/discovery | ✅ Complete |
| `StateManager` | Shared state management | ✅ Complete |
| Tag extraction | Parse frontmatter + inline tags | ✅ Complete |
| Link extraction | Wiki-links, embeds | ✅ Complete |
| Kanban adapter | Refactor to use core | ✅ Complete |
| CSS variables | Shared styling system | ✅ Complete |
| API docs | Reference + guides | ✅ Complete |

### Files Created

**vault-navigator-core:**
- `src/main.ts` (246 lines)
- `src/types/VaultItem.ts` (166 lines)
- `src/types/ViewPlugin.ts` (135 lines)
- `src/types/State.ts` (138 lines)
- `src/core/DataProvider.ts` (221 lines)
- `src/core/MetadataExtractor.ts` (270 lines)
- `src/core/CacheManager.ts` (126 lines)
- `src/registry/ViewRegistry.ts` (120 lines)
- `src/registry/StateManager.ts` (199 lines)
- `src/views/NavigatorViewWrapper.ts` (101 lines)

**Kanban 4000 Integration:**
- `src/core-integration/types.ts` (295 lines)
- `src/core-integration/VaultItemAdapter.ts` (160 lines)
- `src/core-integration/CoreBoardBuilder.ts` (262 lines)
- `src/core-integration/KanbanViewPlugin.ts` (221 lines)

**Documentation:**
- `API_REFERENCE.md` (636 lines)
- `VIEW_PLUGIN_GUIDE.md` (660 lines)
- `EXAMPLE_PLUGIN_TEMPLATE.md` (new)
- `CSS_CUSTOMIZATION_GUIDE.md` (new)

---

## Milestone 2: Metadata Enhancement (v0.2)

**Target:** January 2026  
**Status:** 🟡 In Progress (partial)

### Goals
- [x] Date extraction from content
- [x] Geo extraction from content
- [ ] Backlink resolution (needs refinement)
- [ ] Enhanced caching (performance tuning)

### Deliverables

| Component | Description | Status |
|-----------|-------------|--------|
| Date parser | ISO dates, frontmatter dates | ✅ Complete |
| Geo parser | Coordinates from various formats | ✅ Complete |
| Backlink index | Efficient backlink lookup | 🟡 Basic impl |
| Cache optimization | Incremental updates | 🔴 Not started |
| Natural dates | "next Tuesday", etc. | 🔴 Not started |

---

## Milestone 3: Timeline View (v0.3)

**Target:** February 2026  
**Status:** 🔴 Not Started

### Goals
- [ ] Timeline view plugin
- [ ] Multiple time scales
- [ ] Event clustering
- [ ] Filter integration

### Deliverables

| Component | Description | Priority |
|-----------|-------------|----------|
| Timeline renderer | vis-timeline or custom | P0 |
| Zoom levels | Day/week/month/year | P0 |
| Event clustering | Group overlapping events | P1 |
| Range selection | Filter by dragging | P1 |
| Recurring events | Pattern recognition | P2 |

### Success Criteria
- ✅ Timeline renders items chronologically
- ✅ Zoom works smoothly
- ✅ Selection syncs with other views
- ✅ Filters apply correctly

---

## Milestone 4: Mind Map View (v0.4)

**Target:** Mid-March 2026  
**Status:** 🔴 Not Started

### Goals
- [ ] Graph-based visualization
- [ ] Force-directed layout
- [ ] Link-based navigation
- [ ] Cluster grouping

### Deliverables

| Component | Description | Priority |
|-----------|-------------|----------|
| Graph renderer | d3-force or cytoscape | P0 |
| Node rendering | Files as nodes | P0 |
| Edge rendering | Links as edges | P0 |
| Layout algorithm | Force simulation | P0 |
| Clustering | Auto-group by folder/tag | P1 |
| Path finding | Shortest path between notes | P2 |

### Success Criteria
- ✅ Graph renders with reasonable performance
- ✅ Nodes can be dragged
- ✅ Links are visible and interactive
- ✅ Navigation via graph works

---

## Milestone 5: API Stabilization (v0.5 Beta)

**Target:** End of March 2026  
**Status:** 🔴 Not Started

### Goals
- [ ] API review and finalization
- [ ] Breaking change cleanup
- [ ] Documentation complete
- [ ] Performance optimization

### Deliverables

| Component | Description | Priority |
|-----------|-------------|----------|
| API review | Identify pain points | P0 |
| Breaking changes | Make necessary changes | P0 |
| Migration guide | For early adopters | P0 |
| Performance audit | Identify bottlenecks | P1 |
| Lazy loading | Load metadata on demand | P1 |

### Success Criteria
- ✅ No planned breaking changes
- ✅ API documentation complete
- ✅ Performance acceptable with 10k+ files
- ✅ All tests pass

---

## Milestone 6: Geographic Map View (v0.6)

**Target:** April 2026  
**Status:** 🔴 Not Started

### Goals
- [ ] Interactive map visualization
- [ ] Marker clustering
- [ ] Region filtering
- [ ] Tile provider options

### Deliverables

| Component | Description | Priority |
|-----------|-------------|----------|
| Map renderer | Leaflet.js | P0 |
| Markers | Notes as map markers | P0 |
| Clustering | Combine nearby markers | P0 |
| Region filter | Filter by map bounds | P1 |
| Custom tiles | OSM, satellite, etc. | P2 |
| Track rendering | Connected locations | P2 |

### Success Criteria
- ✅ Map renders geotagged notes
- ✅ Clustering works at zoom levels
- ✅ Click marker → show note
- ✅ Draw region → filter other views

---

## Milestone 7: Stable Release (v1.0)

**Target:** Q2 2026  
**Status:** 🔴 Not Started

### Goals
- [ ] Production-ready stability
- [ ] Community plugin support
- [ ] Obsidian plugin submission

### Deliverables

| Component | Description | Priority |
|-----------|-------------|----------|
| Stability | Bug fixes, edge cases | P0 |
| Plugin guide | For community developers | P0 |
| Example plugin | Template repository | P0 |
| Obsidian submit | Community plugins | P0 |

---

## Future Ideas (Post v1.0)

### Calendar View
- Monthly/weekly calendar
- Drag notes to dates
- Daily notes integration

### Network Analysis
- Centrality metrics
- Orphan detection
- Bridge identification

### Gallery View
- Image-focused display
- Thumbnail grid
- Lightbox viewing

### Table View
- Spreadsheet-like
- Sort/filter columns
- Inline editing

### Custom Views
- JSON configuration
- Template system
- No-code view builder

---

## Technical Debt to Address

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Test coverage | Reliability | High | P1 |
| TypeScript strict mode | Type safety | Medium | P2 |
| Performance profiling | Speed | Medium | P1 |
| Mobile optimization | Platform support | High | P2 |
| Accessibility audit | Inclusivity | Medium | P2 |

---

## Community Goals

### Contributors
- Welcome first-time contributors
- Clear contribution guidelines
- Good first issues labeled

### Documentation
- API reference (✅ drafted)
- Plugin development guide (✅ drafted)
- Video tutorials
- Example plugins

### Support
- GitHub discussions
- Discord channel (maybe)
- FAQ document

---

## Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Core plugin installs | 1000 | 0 |
| View plugins | 5+ | 1 |
| GitHub stars | 100 | 0 |
| Open issues (bugs) | < 10 | 0 |
| Response time (median) | < 48h | N/A |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance issues | Medium | High | Caching, lazy loading |
| Obsidian API changes | Low | Medium | Abstract API usage |
| View plugin isolation | Low | High | Error boundaries |

### Project Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep | High | Medium | Strict milestone scope |
| Burnout | Medium | High | Sustainable pace |
| Low adoption | Medium | Medium | Marketing, docs |

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Immediate Needs
1. **Code review** - Review architecture docs
2. **Testing** - Try current Kanban, report issues
3. **Ideas** - Suggest view types, features
4. **Documentation** - Improve clarity, examples

### Future Needs
1. **View plugins** - Build new views
2. **Translations** - Internationalization
3. **Testing** - Unit tests, integration tests
4. **Performance** - Optimization help

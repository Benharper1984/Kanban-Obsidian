# Kanban 4000

A zoomable Trello-like interface that renders your Obsidian vault folder structure as navigable kanban boards.

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0.0+-purple)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 📂 Folder-Based Kanban

- **Automatic Board Generation**: Your vault folders become kanban lists, and files become cards
- **Zoomable Navigation**: Click on folder cards to "zoom in" and view their contents as a new board
- **Clickable List Headers**: Click on any list header to navigate directly into that folder
- **Breadcrumb Navigation**: Always know where you are with clickable breadcrumbs
- **Navigation History**: Go back to previous views using the back button or keyboard shortcuts

### 🎴 Rich Card Display

- **File Type Icons**: Visual indicators for markdown files, images, and attachments
- **Preview Text**: See the first ~100 characters of markdown files on cards
- **Tag Display**: Automatically extracted tags shown on cards (clickable to filter)
- **Image Thumbnails**: Preview images directly on cards
- **Context Menu**: Right-click cards for quick actions (rename, delete, open in new tab)

### ✏️ Markdown Editor Modal

Click on any markdown file card to open a rich editor modal:

- **Preview Mode**: Rendered markdown view
- **Edit Mode**: Full text editing with save support (Ctrl/Cmd+S)
- **Open in Tab**: Quick access to open in Obsidian's native editor

### 📋 Embedded Kanban Boards

Files containing kanban-style syntax (headers with task lists) are automatically detected. Clicking these files opens a fully interactive embedded kanban board:

```markdown
## To Do
- [ ] Task 1
- [ ] Task 2

## Done
- [x] Completed task
```

**Embedded Board Features:**
- ✅ Toggle task completion directly (checkboxes sync to file)
- ➕ Add new cards to any list
- ➕ Create new lists
- 🗑️ Delete cards
- 🔄 Refresh to sync changes
- ✏️ Edit source to open in Obsidian's editor

### 🔍 Search & Sort

- **Real-time Search**: Filter cards by title, preview text, or tags
- **Multiple Sort Options**: Sort by name, modified date, or created date
- **Sort Direction Toggle**: Ascending or descending order

### 🖱️ Drag & Drop

Move files between folders by dragging cards from one list to another.

### ➕ Quick Create

- **Inline New Note**: Each list has a "New Note" button at the bottom to create files directly in that folder
- **New Folder List**: A "New Folder" placeholder appears at the end of the board to quickly create new folders
- **Toolbar Actions**: Additional new file/folder buttons in the toolbar for quick access

### ⚙️ Customizable Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Root folder | Starting folder for the board | `/` (vault root) |
| Exclude folders | Folders to hide from the board | `.obsidian, _templates, templates, .trash` |
| Sort by | Default sorting method | Name |
| Sort direction | Default sort order | Ascending |
| Card width | Width of list columns (200-400px) | 280px |
| Show preview text | Display text preview on cards | Enabled |
| Show tags | Display extracted tags | Enabled |
| Max tags shown | Maximum tags per card | 5 |
| Show image thumbnails | Display image previews | Enabled |
| Enable animations | Smooth navigation animations | Enabled |
| Auto refresh | Refresh on file changes | Enabled |

### 🔖 Bookmarks Kanban (NEW!)

View your Obsidian bookmarks in a beautiful kanban-style board!

**Features:**
- **Group-Based Columns**: Bookmark groups become kanban columns
- **Multiple Bookmark Types**: Supports files, folders, searches, and graph views
- **Quick Access**: Click to open files, execute searches, or navigate to folders
- **Search & Sort**: Filter and organize your bookmarks
- **Context Menu**: Right-click for quick actions like remove bookmark
- **Nested Groups**: Navigate into bookmark groups for deeper organization

**Keyboard Shortcuts (Bookmarks View):**
| Shortcut | Action |
|----------|--------|
| `Backspace` / `←` | Go back (to parent group) |
| `Escape` | Clear search |
| `/` | Focus search input |
| `R` | Refresh bookmarks |
| `Home` | Go to root bookmark level |

**Note:** Requires the core Bookmarks plugin to be enabled in Obsidian.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Backspace` / `←` | Go back (zoom out) |
| `Escape` | Clear search / Close expanded card |
| `/` or `Ctrl/Cmd+F` | Focus search input |
| `R` | Refresh board |
| `Home` | Go to root folder |

## Installation

### Manual Installation

1. Download the latest release from the releases page
2. Extract the files into your vault's `.obsidian/plugins/kanban-4000/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

### From Source

1. Clone this repository into your vault's `.obsidian/plugins/` folder
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile the plugin
4. Enable the plugin in Obsidian's Community Plugins settings

## Usage

1. **Open the Board**: Click the dashboard icon in the ribbon, or use the command palette:
   - `Open Kanban 4000 Board` - Opens the board at your configured root folder
   - `Open Kanban for Current Folder` - Opens the board focused on the current file's folder
   - `Open Bookmarks Kanban` - Opens your Obsidian bookmarks in kanban view
   - `Refresh Kanban Board` - Manually refresh the board

2. **Navigate**: Click on folder cards to zoom into them, use breadcrumbs or back button to navigate up

3. **Open Files**: 
   - Single click on markdown cards to open the editor modal
   - Single click on kanban-formatted files to view embedded board
   - Double-click to open in a new tab
   - Right-click for context menu (rename, delete, open in tab)

4. **Edit Content**: 
   - In editor modal: Switch between Preview/Edit modes, save with Ctrl/Cmd+S
   - In embedded kanban: Check/uncheck tasks, add cards, create lists

5. **Move Files**: Drag cards between lists to move files to different folders

## Development

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

## Project Structure

```
src/
├── main.ts           # Plugin entry point, commands, and event handlers
├── KanbanView.ts     # Main view class, lifecycle, navigation
├── settings.ts       # Settings tab and configuration
├── types.ts          # TypeScript interfaces and utility functions
├── board/
│   ├── index.ts              # Barrel export for board modules
│   ├── BoardBuilder.ts       # Board construction, file-to-card conversion, sorting
│   ├── BoardRenderer.ts      # Board, list, and card rendering
│   ├── CardActionHandler.ts  # Card click actions, modals, embedded kanban
│   ├── DragDropHandler.ts    # Drag & drop functionality
│   └── ToolbarRenderer.ts    # Header, breadcrumbs, search, sort controls
└── components/
    ├── index.ts              # Barrel export for components
    ├── ContextMenu.ts        # Right-click context menu for cards
    ├── CreateItemModal.ts    # Modal for creating new files/folders
    ├── EmbeddedKanbanViewer.ts # Interactive embedded kanban board
    ├── Icons.ts              # SVG icon definitions
    ├── ImagePreviewModal.ts  # Full-size image preview modal
    └── MarkdownEditorModal.ts # Markdown editor/preview modal
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Ben Harper

---

*Kanban 4000 - Navigate your vault like never before* 🚀

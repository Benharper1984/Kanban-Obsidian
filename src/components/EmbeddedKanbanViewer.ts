import { App, TFile, Notice } from 'obsidian';
import { KanbanMdList, KanbanMdItem, parseKanbanSyntax } from '../types';
import { Icons } from './Icons';

export interface EmbeddedKanbanCallbacks {
	onClose: () => void;
	onOpenInTab: (file: TFile) => Promise<void>;
}

/**
 * Renders an embedded kanban board from a markdown file with kanban syntax.
 * Shows in the main viewer area with a distinct visual style.
 */
export class EmbeddedKanbanViewer {
	private app: App;
	private file: TFile;
	private container: HTMLElement;
	private callbacks: EmbeddedKanbanCallbacks;
	private kanbanLists: KanbanMdList[];
	private content: string = '';

	constructor(
		app: App,
		file: TFile,
		container: HTMLElement,
		kanbanLists: KanbanMdList[],
		callbacks: EmbeddedKanbanCallbacks
	) {
		this.app = app;
		this.file = file;
		this.container = container;
		this.kanbanLists = kanbanLists;
		this.callbacks = callbacks;
	}

	async render() {
		this.container.empty();
		this.container.addClass('kanban-embedded-view');

		// Load current content for editing
		try {
			this.content = await this.app.vault.read(this.file);
		} catch (e) {
			this.container.createEl('div', { 
				cls: 'kanban-error',
				text: 'Failed to load file' 
			});
			return;
		}

		// Header bar with file info and actions
		this.renderHeader();

		// The kanban board
		this.renderKanbanBoard();
	}

	private renderHeader() {
		const header = this.container.createEl('div', { cls: 'kanban-embedded-header' });

		// Back/close button
		const closeBtn = header.createEl('button', { 
			cls: 'kanban-embedded-close-btn',
			attr: { 'aria-label': 'Close and return to folder view' }
		});
		closeBtn.innerHTML = Icons.back;
		closeBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.callbacks.onClose();
		};

		// File info
		const fileInfo = header.createEl('div', { cls: 'kanban-embedded-file-info' });
		
		const icon = fileInfo.createEl('span', { cls: 'kanban-embedded-icon' });
		icon.innerHTML = Icons.kanbanGrid;
		
		fileInfo.createEl('span', { 
			cls: 'kanban-embedded-title',
			text: this.file.basename 
		});

		fileInfo.createEl('span', { 
			cls: 'kanban-embedded-badge',
			text: 'Kanban Board' 
		});

		// Actions
		const actions = header.createEl('div', { cls: 'kanban-embedded-actions' });

		const editBtn = actions.createEl('button', { 
			cls: 'kanban-embedded-action-btn',
			text: 'Edit Source'
		});
		editBtn.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.callbacks.onOpenInTab(this.file);
		};

		const refreshBtn = actions.createEl('button', { 
			cls: 'kanban-embedded-action-btn',
			attr: { 'aria-label': 'Refresh' }
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
		refreshBtn.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.refresh();
		};
	}

	private renderKanbanBoard() {
		const board = this.container.createEl('div', { cls: 'kanban-embedded-board' });

		for (const list of this.kanbanLists) {
			this.renderList(board, list);
		}

		// Add "New List" button at the end
		const addListBtn = board.createEl('button', { 
			cls: 'kanban-embedded-add-list-btn',
			attr: { 'aria-label': 'Add new list' }
		});
		addListBtn.innerHTML = `${Icons.plus}<span>Add List</span>`;
		addListBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showAddListInput(board, addListBtn);
		};
	}

	private renderList(board: HTMLElement, list: KanbanMdList) {
		const listEl = board.createEl('div', { cls: 'kanban-embedded-list' });

		// List header
		const headerEl = listEl.createEl('div', { cls: 'kanban-embedded-list-header' });
		
		headerEl.createEl('span', { 
			cls: 'kanban-embedded-list-title',
			text: list.title 
		});

		// Progress indicator
		const completed = list.items.filter(i => i.completed).length;
		const total = list.items.length;
		headerEl.createEl('span', { 
			cls: 'kanban-embedded-list-count',
			text: `${completed}/${total}` 
		});

		// Items container
		const itemsEl = listEl.createEl('div', { cls: 'kanban-embedded-items' });

		for (const item of list.items) {
			this.renderItem(itemsEl, item, list);
		}

		// Add card button at the bottom of each list
		const addCardBtn = itemsEl.createEl('button', { 
			cls: 'kanban-embedded-add-card-btn'
		});
		addCardBtn.innerHTML = `${Icons.plus}<span>Add card</span>`;
		addCardBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showAddCardInput(itemsEl, list, addCardBtn);
		};
	}

	private renderItem(container: HTMLElement, item: KanbanMdItem, list: KanbanMdList) {
		const itemEl = container.createEl('div', { 
			cls: `kanban-embedded-item ${item.completed ? 'completed' : ''}`
		});

		// Checkbox
		const checkbox = itemEl.createEl('input', {
			cls: 'kanban-embedded-checkbox',
			attr: { type: 'checkbox' }
		});
		checkbox.checked = item.completed;
		
		// Use onclick instead of onchange to have better control
		checkbox.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			const newState = !item.completed;
			checkbox.checked = newState;
			await this.toggleItemComplete(item, list, newState);
		};

		// Item text
		itemEl.createEl('span', { 
			cls: 'kanban-embedded-item-text',
			text: item.text 
		});

		// Delete button (shown on hover via CSS)
		const deleteBtn = itemEl.createEl('button', {
			cls: 'kanban-embedded-item-delete',
			attr: { 'aria-label': 'Delete card' }
		});
		deleteBtn.innerHTML = Icons.close;
		deleteBtn.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.deleteItem(item, list);
		};
	}

	private showAddCardInput(container: HTMLElement, list: KanbanMdList, addBtn: HTMLElement) {
		// Hide the add button
		addBtn.style.display = 'none';

		// Create input container
		const inputContainer = container.createEl('div', { cls: 'kanban-embedded-add-input' });
		
		const input = inputContainer.createEl('input', {
			cls: 'kanban-embedded-card-input',
			attr: { 
				type: 'text',
				placeholder: 'Enter card title...'
			}
		});

		const buttonsEl = inputContainer.createEl('div', { cls: 'kanban-embedded-add-buttons' });
		
		const confirmBtn = buttonsEl.createEl('button', { 
			cls: 'kanban-embedded-confirm-btn',
			text: 'Add'
		});
		
		const cancelBtn = buttonsEl.createEl('button', { 
			cls: 'kanban-embedded-cancel-btn',
			text: 'Cancel'
		});

		// Focus the input
		setTimeout(() => input.focus(), 10);

		const cleanup = () => {
			inputContainer.remove();
			addBtn.style.display = '';
		};

		const addCard = async () => {
			const text = input.value.trim();
			if (text) {
				await this.addCardToList(list, text);
				cleanup();
			}
		};

		confirmBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			addCard();
		};

		cancelBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			cleanup();
		};

		input.onkeydown = (e) => {
			e.stopPropagation();
			if (e.key === 'Enter') {
				e.preventDefault();
				addCard();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cleanup();
			}
		};

		// Prevent clicks from bubbling
		inputContainer.onclick = (e) => e.stopPropagation();
	}

	private showAddListInput(board: HTMLElement, addBtn: HTMLElement) {
		// Hide the add button
		addBtn.style.display = 'none';

		// Create input container
		const inputContainer = board.createEl('div', { cls: 'kanban-embedded-add-list-input' });
		
		const input = inputContainer.createEl('input', {
			cls: 'kanban-embedded-list-input',
			attr: { 
				type: 'text',
				placeholder: 'Enter list title...'
			}
		});

		const buttonsEl = inputContainer.createEl('div', { cls: 'kanban-embedded-add-buttons' });
		
		const confirmBtn = buttonsEl.createEl('button', { 
			cls: 'kanban-embedded-confirm-btn',
			text: 'Add'
		});
		
		const cancelBtn = buttonsEl.createEl('button', { 
			cls: 'kanban-embedded-cancel-btn',
			text: 'Cancel'
		});

		// Focus the input
		setTimeout(() => input.focus(), 10);

		const cleanup = () => {
			inputContainer.remove();
			addBtn.style.display = '';
		};

		const addList = async () => {
			const title = input.value.trim();
			if (title) {
				await this.addNewList(title);
				cleanup();
			}
		};

		confirmBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			addList();
		};

		cancelBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			cleanup();
		};

		input.onkeydown = (e) => {
			e.stopPropagation();
			if (e.key === 'Enter') {
				e.preventDefault();
				addList();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cleanup();
			}
		};

		// Prevent clicks from bubbling
		inputContainer.onclick = (e) => e.stopPropagation();
	}

	private async addCardToList(list: KanbanMdList, cardText: string) {
		// Find the list header in content and add the new item after the last item
		const lines = this.content.split('\n');
		let inTargetList = false;
		let lastItemIndex = -1;
		let listHeaderIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Check for list header
			const headerMatch = line.match(/^#{2,3}\s+(.+)$/);
			if (headerMatch) {
				if (headerMatch[1].trim() === list.title) {
					inTargetList = true;
					listHeaderIndex = i;
				} else if (inTargetList) {
					// We've moved to a new section
					break;
				}
			}
			
			// Track task items in target list
			if (inTargetList && line.match(/^[-*]\s+\[[ xX]\]\s+.+$/)) {
				lastItemIndex = i;
			}
		}

		// Insert the new item
		const newItem = `- [ ] ${cardText}`;
		
		if (lastItemIndex >= 0) {
			// Insert after the last item
			lines.splice(lastItemIndex + 1, 0, newItem);
		} else if (listHeaderIndex >= 0) {
			// Insert right after the header
			lines.splice(listHeaderIndex + 1, 0, newItem);
		} else {
			// Fallback: append to end
			lines.push(newItem);
		}

		this.content = lines.join('\n');
		
		try {
			await this.app.vault.modify(this.file, this.content);
			// Add to local state and re-render
			list.items.push({ text: cardText, completed: false });
			await this.render();
		} catch (e) {
			new Notice('Failed to add card');
		}
	}

	private async addNewList(title: string) {
		// Add a new section at the end of the file
		const newSection = `\n\n## ${title}\n`;
		this.content = this.content.trimEnd() + newSection;

		try {
			await this.app.vault.modify(this.file, this.content);
			// Add to local state and re-render
			this.kanbanLists.push({ title, items: [] });
			await this.render();
		} catch (e) {
			new Notice('Failed to add list');
		}
	}

	private async deleteItem(item: KanbanMdItem, list: KanbanMdList) {
		// Remove the task line from content
		const patterns = [
			`- [ ] ${item.text}`,
			`- [x] ${item.text}`,
			`- [X] ${item.text}`,
			`* [ ] ${item.text}`,
			`* [x] ${item.text}`,
			`* [X] ${item.text}`
		];

		let newContent = this.content;
		for (const pattern of patterns) {
			// Remove the line (including the newline)
			newContent = newContent.replace(pattern + '\n', '');
			newContent = newContent.replace('\n' + pattern, '');
			newContent = newContent.replace(pattern, '');
		}

		if (newContent !== this.content) {
			this.content = newContent;
			
			try {
				await this.app.vault.modify(this.file, this.content);
				// Remove from local state
				const index = list.items.indexOf(item);
				if (index > -1) {
					list.items.splice(index, 1);
				}
				await this.render();
			} catch (e) {
				new Notice('Failed to delete card');
			}
		}
	}

	private async toggleItemComplete(item: KanbanMdItem, list: KanbanMdList, completed: boolean) {
		// Update the content by finding and replacing the task line
		const oldPattern = completed 
			? `- [ ] ${item.text}`
			: `- [x] ${item.text}`;
		const newPattern = completed 
			? `- [x] ${item.text}`
			: `- [ ] ${item.text}`;

		// Also handle * instead of -
		const oldPatternStar = completed 
			? `* [ ] ${item.text}`
			: `* [x] ${item.text}`;
		const newPatternStar = completed 
			? `* [x] ${item.text}`
			: `* [ ] ${item.text}`;

		let newContent = this.content.replace(oldPattern, newPattern);
		if (newContent === this.content) {
			newContent = this.content.replace(oldPatternStar, newPatternStar);
		}
		// Handle case-insensitive X
		if (newContent === this.content) {
			const oldPatternUpper = completed 
				? `- [ ] ${item.text}`
				: `- [X] ${item.text}`;
			const newPatternUpper = completed 
				? `- [x] ${item.text}`
				: `- [ ] ${item.text}`;
			newContent = this.content.replace(oldPatternUpper, newPatternUpper);
		}

		if (newContent !== this.content) {
			this.content = newContent;
			item.completed = completed;
			
			try {
				await this.app.vault.modify(this.file, this.content);
				// Update the UI without full re-render
				// The checkbox state is already updated
			} catch (e) {
				new Notice('Failed to save changes');
				// Revert
				item.completed = !completed;
			}
		}
	}

	async refresh() {
		try {
			this.content = await this.app.vault.read(this.file);
			const parsed = parseKanbanSyntax(this.content);
			if (parsed) {
				this.kanbanLists = parsed;
				await this.render();
			}
		} catch (e) {
			new Notice('Failed to refresh');
		}
	}
}

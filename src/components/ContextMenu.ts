import { Menu, TFile, TFolder, App, Notice, Platform } from 'obsidian';
import { KanbanCard } from '../types';
import { UndoManager } from '../UndoManager';

export interface ContextMenuCallbacks {
	onRename: (card: KanbanCard) => Promise<void>;
	onDelete: (card: KanbanCard) => Promise<void>;
	onOpenInNewTab: (card: KanbanCard) => Promise<void>;
	onOpenInNewPane: (card: KanbanCard) => Promise<void>;
	onRevealInNavigation: (card: KanbanCard) => void;
	onCopyPath: (card: KanbanCard) => void;
	onNavigateTo?: (path: string) => Promise<void>;
}

export class CardContextMenu {
	private app: App;
	private callbacks: ContextMenuCallbacks;

	constructor(app: App, callbacks: ContextMenuCallbacks) {
		this.app = app;
		this.callbacks = callbacks;
	}

	show(event: MouseEvent, card: KanbanCard) {
		event.preventDefault();
		event.stopPropagation();

		const menu = new Menu();

		if (card.type === 'folder') {
			this.buildFolderMenu(menu, card);
		} else {
			this.buildFileMenu(menu, card);
		}

		menu.showAtMouseEvent(event);
	}

	private buildFolderMenu(menu: Menu, card: KanbanCard) {
		// Open folder
		if (this.callbacks.onNavigateTo) {
			menu.addItem((item) => {
				item
					.setTitle('Open folder')
					.setIcon('folder-open')
					.onClick(() => this.callbacks.onNavigateTo?.(card.path));
			});
		}

		menu.addSeparator();

		// Reveal in navigation
		menu.addItem((item) => {
			item
				.setTitle('Reveal in navigation')
				.setIcon('folder-tree')
				.onClick(() => this.callbacks.onRevealInNavigation(card));
		});

		menu.addSeparator();

		// Rename
		menu.addItem((item) => {
			item
				.setTitle('Rename')
				.setIcon('pencil')
				.onClick(() => this.callbacks.onRename(card));
		});

		// Delete
		menu.addItem((item) => {
			item
				.setTitle('Delete')
				.setIcon('trash')
				.onClick(() => this.callbacks.onDelete(card));
		});

		menu.addSeparator();

		// Copy path
		menu.addItem((item) => {
			item
				.setTitle('Copy path')
				.setIcon('copy')
				.onClick(() => this.callbacks.onCopyPath(card));
		});

		// Reveal in system file explorer (desktop only)
		if (Platform.isDesktop) {
			menu.addItem((item) => {
				item
					.setTitle(Platform.isMacOS ? 'Reveal in Finder' : 'Show in Explorer')
					.setIcon('folder-open')
					.onClick(() => this.revealInSystemExplorer(card));
			});
		}
	}

	private buildFileMenu(menu: Menu, card: KanbanCard) {
		// Open in new tab
		menu.addItem((item) => {
			item
				.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(() => this.callbacks.onOpenInNewTab(card));
		});

		// Open to the right
		menu.addItem((item) => {
			item
				.setTitle('Open to the right')
				.setIcon('separator-vertical')
				.onClick(() => this.callbacks.onOpenInNewPane(card));
		});

		menu.addSeparator();

		// Reveal in navigation
		menu.addItem((item) => {
			item
				.setTitle('Reveal in navigation')
				.setIcon('folder-tree')
				.onClick(() => this.callbacks.onRevealInNavigation(card));
		});

		menu.addSeparator();

		// Rename
		menu.addItem((item) => {
			item
				.setTitle('Rename')
				.setIcon('pencil')
				.onClick(() => this.callbacks.onRename(card));
		});

		// Delete
		menu.addItem((item) => {
			item
				.setTitle('Delete')
				.setIcon('trash')
				.onClick(() => this.callbacks.onDelete(card));
		});

		menu.addSeparator();

		// Copy path
		menu.addItem((item) => {
			item
				.setTitle('Copy path')
				.setIcon('copy')
				.onClick(() => this.callbacks.onCopyPath(card));
		});

		// Reveal in system file explorer (desktop only)
		if (Platform.isDesktop) {
			menu.addItem((item) => {
				item
					.setTitle(Platform.isMacOS ? 'Reveal in Finder' : 'Show in Explorer')
					.setIcon('folder-open')
					.onClick(() => this.revealInSystemExplorer(card));
			});
		}
	}

	/**
	 * Reveal file or folder in the system file explorer (Finder/Explorer)
	 */
	private revealInSystemExplorer(card: KanbanCard): void {
		const file = card.file || card.folder;
		if (!file) return;

		// Get the vault's base path
		const vaultPath = (this.app.vault.adapter as any).basePath;
		if (!vaultPath) {
			new Notice('Cannot determine vault location');
			return;
		}

		const fullPath = `${vaultPath}/${file.path}`;

		try {
			// Use Electron's shell module to open in system explorer
			const { shell } = require('electron');
			shell.showItemInFolder(fullPath);
		} catch (e) {
			new Notice('Failed to open file explorer');
		}
	}
}

// Helper functions for context menu actions
export async function renameItem(app: App, card: KanbanCard, undoManager?: UndoManager): Promise<boolean> {
	const file = card.file || card.folder;
	if (!file) return false;

	const isFolder = card.type === 'folder';
	const currentName = isFolder ? card.title : (card.file?.basename || card.title);
	const extension = isFolder ? '' : (card.file?.extension ? `.${card.file.extension}` : '');

	return new Promise((resolve) => {
		const modal = new RenameModal(app, currentName, async (newName) => {
			if (!newName || newName === currentName) {
				resolve(false);
				return;
			}

			try {
				const oldPath = file.path;
				const parentPath = file.parent?.path || '';
				const newPath = parentPath ? `${parentPath}/${newName}${extension}` : `${newName}${extension}`;
				
				await app.fileManager.renameFile(file, newPath);
				
				// Push undo action after successful rename
				if (undoManager) {
					const undoAction = undoManager.createRenameAction(file, oldPath, newPath);
					undoManager.push(undoAction);
				}
				
				new Notice(`Renamed to "${newName}${extension}"`);
				resolve(true);
			} catch (e) {
				new Notice(`Failed to rename: ${e}`);
				resolve(false);
			}
		});
		modal.open();
	});
}

export async function deleteItem(app: App, card: KanbanCard, undoManager?: UndoManager): Promise<boolean> {
	const file = card.file || card.folder;
	if (!file) return false;

	const isFolder = card.type === 'folder';
	const itemType = isFolder ? 'folder' : 'file';

	return new Promise((resolve) => {
		const modal = new ConfirmDeleteModal(app, card.title, itemType, async () => {
			try {
				const originalPath = file.path;
				
				await app.vault.trash(file, true);
				
				// Push undo action after successful delete
				if (undoManager) {
					const undoAction = undoManager.createDeleteAction(file, originalPath);
					undoManager.push(undoAction);
				}
				
				new Notice(`Moved "${card.title}" to trash`);
				resolve(true);
			} catch (e) {
				new Notice(`Failed to delete: ${e}`);
				resolve(false);
			}
		});
		modal.open();
	});
}

export function copyPath(card: KanbanCard) {
	navigator.clipboard.writeText(card.path);
	new Notice('Path copied to clipboard');
}

export function revealInNavigation(app: App, card: KanbanCard) {
	const file = card.file || card.folder;
	if (file) {
		// Use the file explorer to reveal the file
		const fileExplorer = app.workspace.getLeavesOfType('file-explorer')[0];
		if (fileExplorer) {
			(fileExplorer.view as any).revealInFolder?.(file);
		}
	}
}

// Rename Modal
import { Modal, TextComponent } from 'obsidian';

export class RenameModal extends Modal {
	private name: string;
	private onSubmit: (name: string) => void;

	constructor(app: App, currentName: string, onSubmit: (name: string) => void) {
		super(app);
		this.name = currentName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-rename-modal');

		contentEl.createEl('h3', { text: 'Rename' });

		const inputContainer = contentEl.createEl('div', { cls: 'kanban-rename-input-container' });
		const input = new TextComponent(inputContainer);
		input.setValue(this.name);
		input.inputEl.addClass('kanban-rename-input');
		input.inputEl.select();

		input.onChange((value) => {
			this.name = value;
		});

		input.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.submit();
			}
		});

		const buttonContainer = contentEl.createEl('div', { cls: 'kanban-modal-buttons' });
		
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const submitBtn = buttonContainer.createEl('button', { 
			text: 'Rename',
			cls: 'mod-cta'
		});
		submitBtn.onclick = () => this.submit();

		// Focus input after modal is ready
		setTimeout(() => input.inputEl.focus(), 10);
	}

	private submit() {
		this.onSubmit(this.name);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Confirm Delete Modal
class ConfirmDeleteModal extends Modal {
	private itemName: string;
	private itemType: string;
	private onConfirm: () => void;

	constructor(app: App, itemName: string, itemType: string, onConfirm: () => void) {
		super(app);
		this.itemName = itemName;
		this.itemType = itemType;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-delete-modal');

		contentEl.createEl('h3', { text: `Delete ${this.itemType}` });
		contentEl.createEl('p', { 
			text: `Are you sure you want to delete "${this.itemName}"? It will be moved to trash.` 
		});

		const buttonContainer = contentEl.createEl('div', { cls: 'kanban-modal-buttons' });
		
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const deleteBtn = buttonContainer.createEl('button', { 
			text: 'Delete',
			cls: 'mod-warning'
		});
		deleteBtn.onclick = () => {
			this.onConfirm();
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

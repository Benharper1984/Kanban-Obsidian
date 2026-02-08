import { App, Notice, TFile, TFolder, TAbstractFile } from 'obsidian';

export interface UndoAction {
	type: 'move' | 'delete' | 'rename' | 'create';
	description: string;
	undo: () => Promise<void>;
	timestamp: number;
}

/**
 * UndoManager tracks destructive actions and provides undo functionality.
 * Supports move, delete, and rename operations with optional toast notifications.
 */
export class UndoManager {
	private stack: UndoAction[] = [];
	private maxStackSize = 20;
	private showNotifications: boolean = true;
	private noticeTimeout: number = 5000;
	private currentNotice: Notice | null = null;

	constructor(private app: App) {}

	/**
	 * Enable or disable undo notifications
	 */
	setShowNotifications(show: boolean): void {
		this.showNotifications = show;
	}

	/**
	 * Push an undoable action onto the stack
	 */
	push(action: UndoAction): void {
		this.stack.push(action);
		
		// Limit stack size
		if (this.stack.length > this.maxStackSize) {
			this.stack.shift();
		}
		
		// Show notification with undo button
		if (this.showNotifications) {
			this.showUndoNotice(action);
		}
	}

	/**
	 * Undo the last action
	 */
	async undo(): Promise<boolean> {
		const action = this.stack.pop();
		if (!action) {
			new Notice('Nothing to undo');
			return false;
		}

		try {
			await action.undo();
			new Notice(`Undone: ${action.description}`);
			return true;
		} catch (e) {
			new Notice(`Failed to undo: ${e}`);
			// Push the action back if undo failed
			this.stack.push(action);
			return false;
		}
	}

	/**
	 * Check if there are actions to undo
	 */
	canUndo(): boolean {
		return this.stack.length > 0;
	}

	/**
	 * Get description of last action
	 */
	getLastActionDescription(): string | null {
		return this.stack.length > 0 ? this.stack[this.stack.length - 1].description : null;
	}

	/**
	 * Clear the undo stack
	 */
	clear(): void {
		this.stack = [];
	}

	/**
	 * Get the current stack size
	 */
	getStackSize(): number {
		return this.stack.length;
	}

	/**
	 * Show notification with undo button
	 */
	private showUndoNotice(action: UndoAction): void {
		// Close previous notice if exists
		if (this.currentNotice) {
			this.currentNotice.hide();
		}

		// Create fragment with undo button
		const fragment = document.createDocumentFragment();
		
		fragment.createSpan({ text: action.description + ' ' });
		
		const undoBtn = fragment.createEl('a', { 
			text: 'Undo',
			cls: 'kanban-undo-link'
		});
		undoBtn.onclick = async (e) => {
			e.preventDefault();
			await this.undo();
			this.currentNotice?.hide();
		};
		
		this.currentNotice = new Notice(fragment, this.noticeTimeout);
	}

	/**
	 * Create undo action for file/folder move
	 */
	createMoveAction(file: TAbstractFile, oldPath: string, newPath: string): UndoAction {
		const fileName = file.name;
		const isFolder = file instanceof TFolder;
		return {
			type: 'move',
			description: `Moved ${isFolder ? 'folder' : 'file'} "${fileName}"`,
			timestamp: Date.now(),
			undo: async () => {
				const currentFile = this.app.vault.getAbstractFileByPath(newPath);
				if (currentFile) {
					await this.app.fileManager.renameFile(currentFile, oldPath);
				} else {
					throw new Error('File not found at new location');
				}
			}
		};
	}

	/**
	 * Create undo action for file/folder delete (moved to trash)
	 * Note: Obsidian's trash is in .trash folder
	 */
	createDeleteAction(file: TAbstractFile, originalPath: string): UndoAction {
		const fileName = file.name;
		const isFolder = file instanceof TFolder;
		return {
			type: 'delete',
			description: `Deleted ${isFolder ? 'folder' : 'file'} "${fileName}"`,
			timestamp: Date.now(),
			undo: async () => {
				// Find file in trash - Obsidian puts files directly in .trash
				const trashPath = `.trash/${fileName}`;
				const trashedFile = this.app.vault.getAbstractFileByPath(trashPath);
				
				if (trashedFile) {
					await this.app.fileManager.renameFile(trashedFile, originalPath);
				} else {
					throw new Error('File not found in trash - it may have been permanently deleted or renamed');
				}
			}
		};
	}

	/**
	 * Create undo action for rename
	 */
	createRenameAction(file: TAbstractFile, oldPath: string, newPath: string): UndoAction {
		const oldName = oldPath.split('/').pop() || oldPath;
		const newName = file.name;
		const isFolder = file instanceof TFolder;
		return {
			type: 'rename',
			description: `Renamed ${isFolder ? 'folder' : 'file'} "${oldName}" to "${newName}"`,
			timestamp: Date.now(),
			undo: async () => {
				const currentFile = this.app.vault.getAbstractFileByPath(newPath);
				if (currentFile) {
					await this.app.fileManager.renameFile(currentFile, oldPath);
				} else {
					throw new Error('File not found at new location');
				}
			}
		};
	}
}

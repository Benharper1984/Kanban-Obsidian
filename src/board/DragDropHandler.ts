import { App, TFolder, TFile, Notice } from 'obsidian';
import { KanbanCard } from '../types';
import { UndoManager } from '../UndoManager';

/**
 * DragDropHandler manages all drag and drop functionality for kanban cards.
 */
export class DragDropHandler {
	private draggedCard: KanbanCard | null = null;
	private draggedElement: HTMLElement | null = null;

	constructor(
		private app: App,
		private onRefresh: () => Promise<void>,
		private undoManager?: UndoManager
	) {}

	/**
	 * Make a card element draggable
	 */
	makeCardDraggable(cardEl: HTMLElement, card: KanbanCard): void {
		// Disable drag on touch devices - touch drag would require separate implementation
		// with touch events and visual feedback
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		if (isTouchDevice) {
			return;
		}

		cardEl.setAttribute('draggable', 'true');
		
		cardEl.ondragstart = (e) => {
			this.draggedCard = card;
			this.draggedElement = cardEl;
			cardEl.addClass('kanban-card-dragging');
			e.dataTransfer?.setData('text/plain', card.path);
		};
		
		cardEl.ondragend = () => {
			cardEl.removeClass('kanban-card-dragging');
			this.draggedCard = null;
			this.draggedElement = null;
		};
	}

	/**
	 * Setup a container as a drop zone for cards
	 */
	setupDropZone(container: HTMLElement, listPath: string): void {
		container.ondragover = (e) => {
			e.preventDefault();
			
			// Accept internal cards OR external files
			if (this.draggedCard || this.hasExternalFiles(e)) {
				container.addClass('kanban-drop-active');
			}
		};
		
		container.ondragleave = (e) => {
			// Only remove if actually leaving (not entering child)
			if (!container.contains(e.relatedTarget as Node)) {
				container.removeClass('kanban-drop-active');
			}
		};
		
		container.ondrop = async (e) => {
			e.preventDefault();
			container.removeClass('kanban-drop-active');
			
			// Handle internal card drag
			if (this.draggedCard && this.draggedCard.file) {
				await this.handleInternalDrop(listPath);
				return;
			}
			
			// Handle external file drag (from file explorer or OS)
			await this.handleExternalDrop(e, listPath);
		};
	}

	/**
	 * Check if drag event contains files
	 */
	private hasExternalFiles(e: DragEvent): boolean {
		if (!e.dataTransfer) return false;
		
		// Check for Obsidian internal file drag
		const obsidianData = e.dataTransfer.types.includes('text/plain');
		
		// Check for external files
		const hasFiles = e.dataTransfer.types.includes('Files');
		
		return obsidianData || hasFiles;
	}

	/**
	 * Handle internal card being dropped
	 */
	private async handleInternalDrop(listPath: string): Promise<void> {
		if (!this.draggedCard?.file) return;
		
		const targetFolder = this.app.vault.getAbstractFileByPath(listPath);
		if (!(targetFolder instanceof TFolder)) return;
		
		const oldPath = this.draggedCard.file.path;
		const newPath = `${listPath}/${this.draggedCard.file.name}`;
		
		if (oldPath !== newPath) {
			try {
				// Create undo action BEFORE the move
				const undoAction = this.undoManager?.createMoveAction(
					this.draggedCard.file, oldPath, newPath
				);
				
				await this.app.fileManager.renameFile(this.draggedCard.file, newPath);
				
				// Push undo action AFTER successful move
				if (undoAction && this.undoManager) {
					this.undoManager.push(undoAction);
				}
				
				await this.onRefresh();
			} catch (err) {
				new Notice(`Failed to move file: ${err}`);
			}
		}
		
		this.draggedCard = null;
		this.draggedElement = null;
	}

	/**
	 * Handle external file being dropped
	 */
	private async handleExternalDrop(e: DragEvent, listPath: string): Promise<void> {
		const targetFolder = this.app.vault.getAbstractFileByPath(listPath);
		if (!(targetFolder instanceof TFolder)) return;
		
		// Try to get Obsidian internal drag data first
		const obsidianPath = e.dataTransfer?.getData('text/plain');
		
		if (obsidianPath) {
			// This is a drag from Obsidian's file explorer
			const file = this.app.vault.getAbstractFileByPath(obsidianPath);
			
			if (file instanceof TFile) {
				const oldPath = file.path;
				const newPath = `${listPath}/${file.name}`;
				if (oldPath !== newPath) {
					try {
						// Create undo action BEFORE the move
						const undoAction = this.undoManager?.createMoveAction(file, oldPath, newPath);
						
						await this.app.fileManager.renameFile(file, newPath);
						
						// Push undo action AFTER successful move
						if (undoAction && this.undoManager) {
							this.undoManager.push(undoAction);
						}
						
						await this.onRefresh();
					} catch (err) {
						new Notice(`Failed to move file: ${err}`);
					}
				}
				return;
			} else if (file instanceof TFolder) {
				// Moving a folder into another folder
				const oldPath = file.path;
				const newPath = `${listPath}/${file.name}`;
				// Prevent dropping folder into itself
				if (oldPath !== newPath && !newPath.startsWith(file.path + '/')) {
					try {
						// Create undo action BEFORE the move
						const undoAction = this.undoManager?.createMoveAction(file, oldPath, newPath);
						
						await this.app.fileManager.renameFile(file, newPath);
						
						// Push undo action AFTER successful move
						if (undoAction && this.undoManager) {
							this.undoManager.push(undoAction);
						}
						
						await this.onRefresh();
					} catch (err) {
						new Notice(`Failed to move folder: ${err}`);
					}
				}
				return;
			}
		}
		
		// Handle files dragged from outside Obsidian (OS file manager)
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			let imported = 0;
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				try {
					const arrayBuffer = await file.arrayBuffer();
					const newPath = `${listPath}/${file.name}`;
					
					// Check if file already exists
					const existing = this.app.vault.getAbstractFileByPath(newPath);
					if (existing) {
						new Notice(`File "${file.name}" already exists in target folder`);
						continue;
					}
					
					await this.app.vault.createBinary(newPath, arrayBuffer);
					imported++;
				} catch (err) {
					new Notice(`Failed to import ${file.name}: ${err}`);
				}
			}
			if (imported > 0) {
				new Notice(`Imported ${imported} file${imported > 1 ? 's' : ''}`);
				await this.onRefresh();
			}
		}
	}

	/**
	 * Get the currently dragged card
	 */
	getDraggedCard(): KanbanCard | null {
		return this.draggedCard;
	}

	/**
	 * Get the currently dragged element
	 */
	getDraggedElement(): HTMLElement | null {
		return this.draggedElement;
	}
}

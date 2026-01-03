import { App, TFolder } from 'obsidian';
import { KanbanCard } from '../types';

/**
 * DragDropHandler manages all drag and drop functionality for kanban cards.
 */
export class DragDropHandler {
	private draggedCard: KanbanCard | null = null;
	private draggedElement: HTMLElement | null = null;

	constructor(
		private app: App,
		private onRefresh: () => Promise<void>
	) {}

	/**
	 * Make a card element draggable
	 */
	makeCardDraggable(cardEl: HTMLElement, card: KanbanCard): void {
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
			container.addClass('kanban-drop-active');
		};
		
		container.ondragleave = (e) => {
			container.removeClass('kanban-drop-active');
		};
		
		container.ondrop = async (e) => {
			e.preventDefault();
			container.removeClass('kanban-drop-active');
			
			if (this.draggedCard && this.draggedCard.file) {
				const targetFolder = this.app.vault.getAbstractFileByPath(listPath);
				if (targetFolder instanceof TFolder) {
					const oldPath = this.draggedCard.file.path;
					const newPath = `${listPath}/${this.draggedCard.file.name}`;
					
					// Don't move to same location
					if (oldPath !== newPath) {
						try {
							await this.app.fileManager.renameFile(this.draggedCard.file, newPath);
							await this.onRefresh(); // Refresh the board
						} catch (err) {
							console.error('Failed to move file:', err);
						}
					}
				}
			}
			
			this.draggedCard = null;
			this.draggedElement = null;
		};
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

import { App, TFolder, TFile } from 'obsidian';
import { KanbanCard } from '../types';
import { 
	CreateItemModal,
	createNewFile,
	createNewFolder,
	ImagePreviewModal,
	MarkdownEditorModal,
	EmbeddedKanbanViewer
} from '../components';

export interface CardActionCallbacks {
	onNavigateTo: (path: string) => Promise<void>;
	onRender: () => Promise<void>;
}

/**
 * CardActionHandler manages card click actions, modal displays, and embedded kanban views.
 */
export class CardActionHandler {
	private embeddedKanbanCard: KanbanCard | null = null;
	private embeddedKanbanViewer: EmbeddedKanbanViewer | null = null;

	constructor(
		private app: App,
		private callbacks: CardActionCallbacks
	) {}

	/**
	 * Check if currently showing an embedded kanban view
	 */
	isInEmbeddedMode(): boolean {
		return this.embeddedKanbanViewer !== null;
	}

	/**
	 * Refresh the embedded kanban view if active
	 */
	async refreshEmbeddedView(): Promise<void> {
		if (this.embeddedKanbanViewer) {
			await this.embeddedKanbanViewer.refresh();
		}
	}

	/**
	 * Handle card click based on card type
	 */
	async handleCardClick(card: KanbanCard, contentEl: HTMLElement): Promise<void> {
		switch (card.type) {
			case 'folder':
				await this.callbacks.onNavigateTo(card.path);
				break;
			
			case 'markdown':
				if (card.file) {
					if (card.hasKanbanSyntax && card.kanbanLists) {
						this.showEmbeddedKanban(card, contentEl);
					} else {
						const modal = new MarkdownEditorModal(this.app, card.file);
						modal.open();
					}
				}
				break;
			
			case 'image':
				if (card.file) {
					this.openImageModal(card);
				}
				break;
			
			case 'attachment':
				if (card.file) {
					await this.app.workspace.getLeaf('tab').openFile(card.file);
				}
				break;
		}
	}

	/**
	 * Show embedded kanban view for a file with kanban syntax
	 */
	showEmbeddedKanban(card: KanbanCard, contentEl: HTMLElement): void {
		if (!card.file || !card.kanbanLists) return;

		this.embeddedKanbanCard = card;
		contentEl.empty();
		contentEl.addClass('kanban-embedded-mode');

		this.embeddedKanbanViewer = new EmbeddedKanbanViewer(
			this.app,
			card.file,
			contentEl,
			card.kanbanLists,
			{
				onClose: () => this.closeEmbeddedKanban(contentEl),
				onOpenInTab: async (file) => {
					await this.app.workspace.getLeaf('tab').openFile(file);
				}
			}
		);

		this.embeddedKanbanViewer.render();
	}

	/**
	 * Close embedded kanban view and return to folder view
	 */
	async closeEmbeddedKanban(contentEl: HTMLElement): Promise<void> {
		this.embeddedKanbanCard = null;
		this.embeddedKanbanViewer = null;
		contentEl.removeClass('kanban-embedded-mode');
		await this.callbacks.onRender();
	}

	/**
	 * Open image in a modal preview
	 */
	openImageModal(card: KanbanCard): void {
		if (!card.file) return;
		
		const modal = new ImagePreviewModal(this.app, card.file);
		modal.open();
	}

	/**
	 * Check if embedded kanban view is currently open
	 */
	hasEmbeddedKanban(): boolean {
		return this.embeddedKanbanCard !== null;
	}

	/**
	 * Get the currently displayed embedded kanban card
	 */
	getEmbeddedKanbanCard(): KanbanCard | null {
		return this.embeddedKanbanCard;
	}
}

/**
 * ModalHandler manages create file/folder modals.
 */
export class ModalHandler {
	constructor(
		private app: App,
		private onRender: () => Promise<void>
	) {}

	/**
	 * Show modal to create a new file in the current folder
	 */
	showCreateFileModal(folder: TFolder | null): void {
		if (!folder) return;

		const modal = new CreateItemModal(
			this.app,
			'file',
			folder,
			async (name) => {
				await createNewFile(this.app, folder, name);
				await this.onRender();
			}
		);
		modal.open();
	}

	/**
	 * Show modal to create a new folder in the current folder
	 */
	showCreateFolderModal(folder: TFolder | null): void {
		if (!folder) return;

		const modal = new CreateItemModal(
			this.app,
			'folder',
			folder,
			async (name) => {
				await createNewFolder(this.app, folder, name);
				await this.onRender();
			}
		);
		modal.open();
	}

	/**
	 * Show modal to create a new file in a specific folder path
	 */
	showCreateFileModalInFolder(folderPath: string): void {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder || !(folder instanceof TFolder)) return;

		const modal = new CreateItemModal(
			this.app,
			'file',
			folder,
			async (name) => {
				await createNewFile(this.app, folder, name);
				await this.onRender();
			}
		);
		modal.open();
	}
}

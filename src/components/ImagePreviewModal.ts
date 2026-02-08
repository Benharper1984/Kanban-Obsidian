import { App, Modal, TFile } from 'obsidian';
import { BookmarkService } from '../BookmarkService';
import { Icons } from './Icons';

export class ImagePreviewModal extends Modal {
	file: TFile;
	private bookmarkService: BookmarkService;
	private bookmarkBtn: HTMLElement | null = null;

	constructor(app: App, file: TFile) {
		super(app);
		this.file = file;
		this.bookmarkService = new BookmarkService(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-image-modal');
		
		// Header with title and bookmark button
		const header = contentEl.createEl('div', { cls: 'kanban-image-modal-header' });
		header.createEl('h3', { text: this.file.name });
		this.renderBookmarkButton(header);
		
		const imgContainer = contentEl.createEl('div', { cls: 'kanban-image-modal-content' });
		imgContainer.createEl('img', {
			attr: {
				src: this.app.vault.getResourcePath(this.file),
				alt: this.file.name
			}
		});
		
		const actionsEl = contentEl.createEl('div', { cls: 'kanban-image-modal-actions' });
		const openBtn = actionsEl.createEl('button', { text: 'Open in Tab' });
		openBtn.onclick = async () => {
			await this.app.workspace.getLeaf('tab').openFile(this.file);
			this.close();
		};
	}

	/**
	 * Render the bookmark toggle button
	 */
	private renderBookmarkButton(container: HTMLElement): void {
		const isBookmarked = this.bookmarkService.isBookmarked(this.file.path);
		
		this.bookmarkBtn = container.createEl('button', {
			cls: `kanban-modal-bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}`,
			attr: { 'aria-label': isBookmarked ? 'Remove bookmark' : 'Add bookmark' }
		});
		this.bookmarkBtn.innerHTML = Icons.bookmark;
		
		this.bookmarkBtn.onclick = async () => {
			const success = await this.bookmarkService.toggleBookmark(this.file.path);
			if (success) {
				const nowBookmarked = this.bookmarkService.isBookmarked(this.file.path);
				this.bookmarkBtn?.toggleClass('is-bookmarked', nowBookmarked);
				this.bookmarkBtn?.setAttribute('aria-label', 
					nowBookmarked ? 'Remove bookmark' : 'Add bookmark'
				);
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

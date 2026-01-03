import { App, Modal, TFile } from 'obsidian';

export class ImagePreviewModal extends Modal {
	file: TFile;

	constructor(app: App, file: TFile) {
		super(app);
		this.file = file;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-image-modal');
		
		contentEl.createEl('h3', { text: this.file.name });
		
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

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

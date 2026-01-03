import { App, Modal, TFile, MarkdownRenderer, Notice, Component } from 'obsidian';

/**
 * Modal for viewing and editing markdown files
 */
export class MarkdownEditorModal extends Modal {
	private file: TFile;
	private content: string = '';
	private isEditMode: boolean = false;
	private displayEl: HTMLElement | null = null;
	private textareaEl: HTMLTextAreaElement | null = null;
	private renderComponent: Component;

	constructor(app: App, file: TFile) {
		super(app);
		this.file = file;
		this.renderComponent = new Component();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-md-editor-modal');

		// Load content
		try {
			this.content = await this.app.vault.read(this.file);
		} catch (e) {
			new Notice('Failed to load file content');
			this.close();
			return;
		}

		// Header with title and actions
		const header = contentEl.createEl('div', { cls: 'kanban-md-modal-header' });
		
		const titleEl = header.createEl('h3', { 
			cls: 'kanban-md-modal-title',
			text: this.file.basename 
		});

		const actionsEl = header.createEl('div', { cls: 'kanban-md-modal-actions' });

		// View/Edit toggle buttons
		const viewBtn = actionsEl.createEl('button', { 
			cls: 'kanban-md-modal-btn active',
			text: 'Preview'
		});
		const editBtn = actionsEl.createEl('button', { 
			cls: 'kanban-md-modal-btn',
			text: 'Edit'
		});
		const openBtn = actionsEl.createEl('button', { 
			cls: 'kanban-md-modal-btn',
			text: 'Open in Tab'
		});

		// Content area
		const contentArea = contentEl.createEl('div', { cls: 'kanban-md-modal-content' });
		
		// Display area for preview
		this.displayEl = contentArea.createEl('div', { cls: 'kanban-md-modal-display' });
		
		// Textarea for editing (hidden initially)
		this.textareaEl = contentArea.createEl('textarea', { 
			cls: 'kanban-md-modal-editor hidden'
		});
		this.textareaEl.value = this.content;

		// Render initial preview
		await this.renderPreview();

		// Event handlers
		viewBtn.onclick = async () => {
			if (this.isEditMode) {
				await this.saveContent();
				this.isEditMode = false;
				viewBtn.addClass('active');
				editBtn.removeClass('active');
				this.displayEl?.removeClass('hidden');
				this.textareaEl?.addClass('hidden');
				await this.renderPreview();
			}
		};

		editBtn.onclick = () => {
			if (!this.isEditMode) {
				this.isEditMode = true;
				editBtn.addClass('active');
				viewBtn.removeClass('active');
				this.displayEl?.addClass('hidden');
				this.textareaEl?.removeClass('hidden');
				this.textareaEl?.focus();
			}
		};

		openBtn.onclick = async () => {
			await this.saveContent();
			await this.app.workspace.getLeaf('tab').openFile(this.file);
			this.close();
		};

		// Auto-resize textarea
		this.textareaEl.oninput = () => {
			if (this.textareaEl) {
				this.textareaEl.style.height = 'auto';
				this.textareaEl.style.height = this.textareaEl.scrollHeight + 'px';
			}
		};

		// Save on Ctrl+S
		contentEl.addEventListener('keydown', async (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				await this.saveContent();
				new Notice('Saved');
			}
		});
	}

	private async renderPreview() {
		if (!this.displayEl) return;
		
		this.displayEl.empty();
		this.renderComponent.unload();
		this.renderComponent = new Component();
		this.renderComponent.load();

		await MarkdownRenderer.render(
			this.app,
			this.content,
			this.displayEl,
			this.file.path,
			this.renderComponent
		);
	}

	private async saveContent() {
		if (this.textareaEl && this.textareaEl.value !== this.content) {
			this.content = this.textareaEl.value;
			try {
				await this.app.vault.modify(this.file, this.content);
			} catch (e) {
				new Notice('Failed to save file');
			}
		}
	}

	async onClose() {
		// Save any pending changes
		if (this.isEditMode) {
			await this.saveContent();
		}
		this.renderComponent.unload();
		const { contentEl } = this;
		contentEl.empty();
	}
}

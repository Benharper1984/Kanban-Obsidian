import { App, Modal, TextComponent, Notice, TFolder, Setting } from 'obsidian';

export type ItemType = 'file' | 'folder';

export class CreateItemModal extends Modal {
	private itemType: ItemType;
	private targetFolder: TFolder;
	private name: string = '';
	private createAsKanban: boolean = false;
	private onSubmit: (name: string, asKanban?: boolean) => Promise<void>;

	constructor(
		app: App, 
		itemType: ItemType, 
		targetFolder: TFolder,
		onSubmit: (name: string, asKanban?: boolean) => Promise<void>
	) {
		super(app);
		this.itemType = itemType;
		this.targetFolder = targetFolder;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-create-modal');

		const title = this.itemType === 'file' ? 'Create new note' : 'Create new folder';
		contentEl.createEl('h3', { text: title });

		const folderPath = this.targetFolder.path || 'vault root';
		contentEl.createEl('p', { 
			cls: 'kanban-create-location',
			text: `Location: ${folderPath}` 
		});

		const inputContainer = contentEl.createEl('div', { cls: 'kanban-create-input-container' });
		
		const input = new TextComponent(inputContainer);
		input.setPlaceholder(this.itemType === 'file' ? 'Note name' : 'Folder name');
		input.inputEl.addClass('kanban-create-input');

		input.onChange((value) => {
			this.name = value;
		});

		input.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.submit();
			}
		});

		// Add "Create as Kanban" toggle for files only
		if (this.itemType === 'file') {
			const toggleContainer = contentEl.createEl('div', { 
				cls: 'kanban-create-toggle-container' 
			});
			
			new Setting(toggleContainer)
				.setName('Create as Kanban board')
				.setDesc('Pre-populate with kanban template')
				.addToggle(toggle => toggle
					.setValue(this.createAsKanban)
					.onChange((value) => {
						this.createAsKanban = value;
					})
				);
		}

		const buttonContainer = contentEl.createEl('div', { cls: 'kanban-modal-buttons' });
		
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const submitBtn = buttonContainer.createEl('button', { 
			text: 'Create',
			cls: 'mod-cta'
		});
		submitBtn.onclick = () => this.submit();

		// Focus input after modal is ready
		setTimeout(() => input.inputEl.focus(), 10);
	}

	private async submit() {
		if (!this.name.trim()) {
			new Notice('Please enter a name');
			return;
		}

		try {
			await this.onSubmit(this.name.trim(), this.createAsKanban);
			this.close();
		} catch (e) {
			new Notice(`Failed to create: ${e}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Helper function to create a new file
export async function createNewFile(
	app: App, 
	folder: TFolder, 
	name: string,
	asKanban: boolean = false
): Promise<void> {
	// Add .md extension if not present
	const fileName = name.endsWith('.md') ? name : `${name}.md`;
	const filePath = folder.path ? `${folder.path}/${fileName}` : fileName;

	// Check if file already exists
	const existing = app.vault.getAbstractFileByPath(filePath);
	if (existing) {
		throw new Error('A file with this name already exists');
	}

	// Create content based on whether it's a kanban board
	let content = '';
	if (asKanban) {
		content = `## To Do

- [ ] First task

## In Progress

- [ ] 

## Done

- [x] Example completed task
`;
	}

	const file = await app.vault.create(filePath, content);
	new Notice(`Created "${fileName}"${asKanban ? ' as Kanban board' : ''}`);
	
	// Optionally open the new file
	await app.workspace.getLeaf('tab').openFile(file);
}

// Helper function to create a new folder
export async function createNewFolder(
	app: App, 
	parentFolder: TFolder, 
	name: string
): Promise<void> {
	const folderPath = parentFolder.path ? `${parentFolder.path}/${name}` : name;

	// Check if folder already exists
	const existing = app.vault.getAbstractFileByPath(folderPath);
	if (existing) {
		throw new Error('A folder with this name already exists');
	}

	await app.vault.createFolder(folderPath);
	new Notice(`Created folder "${name}"`);
}

/**
 * Modal for saving the current filter configuration as a named preset
 */
export class SaveFilterModal extends Modal {
	private name: string = '';
	private onSubmit: (name: string) => void;

	constructor(app: App, onSubmit: (name: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('kanban-create-modal');

		contentEl.createEl('h3', { text: 'Save Filter' });
		contentEl.createEl('p', { 
			cls: 'kanban-create-location',
			text: 'Save your current filter settings as a reusable preset.' 
		});

		const inputContainer = contentEl.createEl('div', { cls: 'kanban-create-input-container' });
		
		const input = new TextComponent(inputContainer);
		input.setPlaceholder('Filter name');
		input.inputEl.addClass('kanban-create-input');

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
			text: 'Save',
			cls: 'mod-cta'
		});
		submitBtn.onclick = () => this.submit();

		// Focus input after modal is ready
		setTimeout(() => input.inputEl.focus(), 10);
	}

	private submit() {
		if (!this.name.trim()) {
			new Notice('Please enter a name');
			return;
		}

		this.onSubmit(this.name.trim());
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

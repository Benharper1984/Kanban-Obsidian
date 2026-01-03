import { App, Modal, TextComponent, Notice, TFolder } from 'obsidian';

export type ItemType = 'file' | 'folder';

export class CreateItemModal extends Modal {
	private itemType: ItemType;
	private targetFolder: TFolder;
	private name: string = '';
	private onSubmit: (name: string) => Promise<void>;

	constructor(
		app: App, 
		itemType: ItemType, 
		targetFolder: TFolder,
		onSubmit: (name: string) => Promise<void>
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
			await this.onSubmit(this.name.trim());
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
	name: string
): Promise<void> {
	// Add .md extension if not present
	const fileName = name.endsWith('.md') ? name : `${name}.md`;
	const filePath = folder.path ? `${folder.path}/${fileName}` : fileName;

	// Check if file already exists
	const existing = app.vault.getAbstractFileByPath(filePath);
	if (existing) {
		throw new Error('A file with this name already exists');
	}

	const file = await app.vault.create(filePath, '');
	new Notice(`Created "${fileName}"`);
	
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

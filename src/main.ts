import { Plugin, WorkspaceLeaf, TAbstractFile } from 'obsidian';
import { KanbanView, VIEW_TYPE_KANBAN } from './KanbanView';
import { Kanban4000Settings, DEFAULT_SETTINGS, Kanban4000SettingTab } from './settings';
import { KanbanViewPlugin } from './core-integration';
import type { NavigatorCore } from './core-integration/types';
import { UndoManager } from './UndoManager';

// Declare global NavigatorCore type
declare global {
	interface Window {
		NavigatorCore?: NavigatorCore;
	}
}

export default class Kanban4000Plugin extends Plugin {
	settings: Kanban4000Settings;
	undoManager: UndoManager;
	private fileChangeTimeout: NodeJS.Timeout | null = null;
	private kanbanViewPlugin: KanbanViewPlugin | null = null;
	private coreConnected: boolean = false;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Initialize undo manager
		this.undoManager = new UndoManager(this.app);
		this.undoManager.setShowNotifications(this.settings.showUndoNotifications);

		// Register the custom view
		this.registerView(
			VIEW_TYPE_KANBAN,
			(leaf) => new KanbanView(leaf, this)
		);

		// Try to register with Navigator Core
		this.tryRegisterWithCore();

		// Add settings tab
		this.addSettingTab(new Kanban4000SettingTab(this.app, this));

		// Add ribbon icon to open the kanban view
		this.addRibbonIcon('layout-dashboard', 'Open Kanban 4000', () => {
			this.activateView();
		});

		// Add command to open the view
		this.addCommand({
			id: 'open-kanban-4000',
			name: 'Open Kanban 4000 Board',
			callback: () => {
				this.activateView();
			}
		});

		// Add command to open kanban for current folder
		this.addCommand({
			id: 'open-kanban-current-folder',
			name: 'Open Kanban for Current Folder',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					const folderPath = activeFile.parent?.path || '/';
					this.activateView(folderPath);
				} else {
					this.activateView();
				}
			}
		});

		// Add command to refresh kanban
		this.addCommand({
			id: 'refresh-kanban',
			name: 'Refresh Kanban Board',
			callback: () => {
				this.refreshAllViews();
			}
		});

		// Add command to undo last Kanban action
		this.addCommand({
			id: 'undo-last-action',
			name: 'Undo last Kanban action',
			callback: async () => {
				const success = await this.undoManager.undo();
				if (success) {
					this.refreshAllViews();
				}
			}
		});


		// Watch for file changes if auto-refresh is enabled
		this.registerEvent(
			this.app.vault.on('create', (file) => this.onFileChange(file))
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => this.onFileChange(file))
		);
		this.registerEvent(
			this.app.vault.on('rename', (file) => this.onFileChange(file))
		);
		this.registerEvent(
			this.app.vault.on('modify', (file) => this.onFileChange(file))
		);
	}

	/**
	 * Try to register with Navigator Core
	 */
	private tryRegisterWithCore(): void {
		// Check if Navigator Core is already loaded
		if (window.NavigatorCore) {
			this.registerWithCore(window.NavigatorCore);
			return;
		}

		// If not, wait a bit and try again (core might load after us)
		setTimeout(() => {
			if (window.NavigatorCore && !this.coreConnected) {
				this.registerWithCore(window.NavigatorCore);
			}
		}, 1000);
	}

	/**
	 * Register with Navigator Core
	 */
	private registerWithCore(core: NavigatorCore): void {
		try {
			this.kanbanViewPlugin = new KanbanViewPlugin(this);
			(core as any).registerViewPlugin(this.kanbanViewPlugin);
			this.coreConnected = true;
			console.log('Kanban 4000: Successfully registered with Navigator Core');
		} catch (e) {
			console.warn('Kanban 4000: Failed to register with Navigator Core', e);
		}
	}

	/**
	 * Check if connected to Navigator Core
	 */
	isConnectedToCore(): boolean {
		return this.coreConnected;
	}

	/**
	 * Get the Navigator Core instance if connected
	 */
	getNavigatorCore(): NavigatorCore | null {
		return this.kanbanViewPlugin?.getCore() ?? null;
	}

	/**
	 * Get the CoreStateSync instance for state synchronization
	 */
	getStateSync() {
		return this.kanbanViewPlugin?.getStateSync() ?? null;
	}

	async onunload() {
		// Unregister from Navigator Core if connected
		if (this.coreConnected && window.NavigatorCore && this.kanbanViewPlugin) {
			try {
				(window.NavigatorCore as any).unregisterViewPlugin('kanban-4000');
			} catch (e) {
				// Ignore errors during unload
			}
		}

		// Clean up views when plugin is disabled
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_KANBAN);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Refresh views when settings change
		this.refreshAllViews();
	}

	// Handle file changes with debouncing
	onFileChange(file: TAbstractFile) {
		if (!this.settings.autoRefresh) return;

		// Debounce to avoid too many refreshes
		if (this.fileChangeTimeout) {
			clearTimeout(this.fileChangeTimeout);
		}
		this.fileChangeTimeout = setTimeout(() => {
			this.refreshAllViews();
			this.fileChangeTimeout = null;
		}, 500);
	}

	// Refresh all open Kanban views
	refreshAllViews() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN);
		for (const leaf of leaves) {
			const view = leaf.view as KanbanView;
			if (view && view.render) {
				view.render();
			}
		}
	}

	async activateView(folderPath?: string) {
		const { workspace } = this.app;

		// Use settings root folder if no path provided
		const targetPath = folderPath || this.settings.rootFolder;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_KANBAN);

		if (leaves.length > 0) {
			// A view already exists, use it
			leaf = leaves[0];
		} else {
			// Create a new leaf in the main area
			leaf = workspace.getLeaf('tab');
		}

		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_KANBAN,
				active: true,
				state: { folderPath: targetPath }
			});

			// Focus the leaf
			workspace.revealLeaf(leaf);
		}
	}
}

import { App, PluginSettingTab, Setting } from 'obsidian';
import Kanban4000Plugin from './main';
import { SortOption } from './types';

export interface Kanban4000Settings {
	excludePatterns: string[];
	defaultSortBy: SortOption;
	defaultSortDirection: 'asc' | 'desc';
	rootFolder: string;
	showPreviewText: boolean;
	showTags: boolean;
	showImageThumbnails: boolean;
	cardWidth: number;
	maxTagsShown: number;
	enableAnimations: boolean;
	autoRefresh: boolean;
}

export const DEFAULT_SETTINGS: Kanban4000Settings = {
	excludePatterns: ['.obsidian', '_templates', 'templates', '.trash'],
	defaultSortBy: 'name',
	defaultSortDirection: 'asc',
	rootFolder: '/',
	showPreviewText: true,
	showTags: true,
	showImageThumbnails: true,
	cardWidth: 280,
	maxTagsShown: 5,
	enableAnimations: true,
	autoRefresh: true
};

export class Kanban4000SettingTab extends PluginSettingTab {
	plugin: Kanban4000Plugin;

	constructor(app: App, plugin: Kanban4000Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Kanban 4000 Settings' });

		// Root Folder
		new Setting(containerEl)
			.setName('Root folder')
			.setDesc('The folder to use as the root of your Kanban board. Leave as "/" for vault root.')
			.addText(text => text
				.setPlaceholder('/')
				.setValue(this.plugin.settings.rootFolder)
				.onChange(async (value) => {
					this.plugin.settings.rootFolder = value || '/';
					await this.plugin.saveSettings();
				}));

		// Exclude Patterns
		new Setting(containerEl)
			.setName('Exclude folders')
			.setDesc('Comma-separated list of folder names to exclude from the board.')
			.addTextArea(text => text
				.setPlaceholder('.obsidian, _templates, .trash')
				.setValue(this.plugin.settings.excludePatterns.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludePatterns = value
						.split(',')
						.map(s => s.trim())
						.filter(s => s.length > 0);
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Default Sort' });

		// Default Sort By
		new Setting(containerEl)
			.setName('Sort by')
			.setDesc('Default sorting method for cards.')
			.addDropdown(dropdown => dropdown
				.addOption('name', 'Name')
				.addOption('modified', 'Modified Date')
				.addOption('created', 'Created Date')
				.setValue(this.plugin.settings.defaultSortBy)
				.onChange(async (value) => {
					this.plugin.settings.defaultSortBy = value as SortOption;
					await this.plugin.saveSettings();
				}));

		// Default Sort Direction
		new Setting(containerEl)
			.setName('Sort direction')
			.setDesc('Default sort direction.')
			.addDropdown(dropdown => dropdown
				.addOption('asc', 'Ascending')
				.addOption('desc', 'Descending')
				.setValue(this.plugin.settings.defaultSortDirection)
				.onChange(async (value) => {
					this.plugin.settings.defaultSortDirection = value as 'asc' | 'desc';
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Display Options' });

		// Card Width
		new Setting(containerEl)
			.setName('Card width')
			.setDesc('Width of list columns in pixels (200-400).')
			.addSlider(slider => slider
				.setLimits(200, 400, 20)
				.setValue(this.plugin.settings.cardWidth)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.cardWidth = value;
					await this.plugin.saveSettings();
				}));

		// Show Preview Text
		new Setting(containerEl)
			.setName('Show preview text')
			.setDesc('Display the first ~100 characters of markdown files on cards.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPreviewText)
				.onChange(async (value) => {
					this.plugin.settings.showPreviewText = value;
					await this.plugin.saveSettings();
				}));

		// Show Tags
		new Setting(containerEl)
			.setName('Show tags')
			.setDesc('Display tags extracted from file content.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTags)
				.onChange(async (value) => {
					this.plugin.settings.showTags = value;
					await this.plugin.saveSettings();
				}));

		// Max Tags Shown
		new Setting(containerEl)
			.setName('Maximum tags shown')
			.setDesc('Maximum number of tags to display per card.')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.plugin.settings.maxTagsShown)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxTagsShown = value;
					await this.plugin.saveSettings();
				}));

		// Show Image Thumbnails
		new Setting(containerEl)
			.setName('Show image thumbnails')
			.setDesc('Display thumbnail previews for image files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showImageThumbnails)
				.onChange(async (value) => {
					this.plugin.settings.showImageThumbnails = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Behavior' });

		// Enable Animations
		new Setting(containerEl)
			.setName('Enable animations')
			.setDesc('Smooth animations when navigating and expanding cards.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAnimations)
				.onChange(async (value) => {
					this.plugin.settings.enableAnimations = value;
					await this.plugin.saveSettings();
				}));

		// Auto Refresh
		new Setting(containerEl)
			.setName('Auto refresh')
			.setDesc('Automatically refresh the board when files change.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Keyboard Shortcuts' });
		
		const shortcutsDiv = containerEl.createEl('div', { cls: 'kanban-shortcuts-info' });
		shortcutsDiv.innerHTML = `
			<p>The following keyboard shortcuts are available when the Kanban view is focused:</p>
			<ul>
				<li><kbd>Backspace</kbd> / <kbd>←</kbd> - Go back (zoom out)</li>
				<li><kbd>Escape</kbd> - Clear search / Close expanded card</li>
				<li><kbd>/</kbd> or <kbd>Ctrl+F</kbd> - Focus search</li>
				<li><kbd>R</kbd> - Refresh board</li>
				<li><kbd>Home</kbd> - Go to root</li>
			</ul>
		`;

		containerEl.createEl('h3', { text: 'Bookmarks Kanban' });
		
		const bookmarksDiv = containerEl.createEl('div', { cls: 'kanban-shortcuts-info' });
		bookmarksDiv.innerHTML = `
			<p>The Bookmarks Kanban view displays your Obsidian bookmarks in a kanban-style board:</p>
			<ul>
				<li>Bookmark groups become columns</li>
				<li>Click on files to open them</li>
				<li>Click on groups to navigate into them</li>
				<li>Right-click for context menu options</li>
				<li>Search and sort bookmarks using the toolbar</li>
			</ul>
			<p><strong>Note:</strong> The core Bookmarks plugin must be enabled for this feature to work.</p>
		`;
	}
}

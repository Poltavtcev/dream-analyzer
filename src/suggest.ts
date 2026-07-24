import { AbstractInputSuggest, App, TFolder, TFile, TextComponent } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textComponent: TextComponent;
	private onSelectCallback: (value: string) => void;

	constructor(app: App, textComponent: TextComponent, onSelectCallback: (value: string) => void) {
		super(app, textComponent.inputEl);
		this.textComponent = textComponent;
		this.onSelectCallback = onSelectCallback;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerInputStr = (inputStr || "").toLowerCase();

		for (const file of abstractFiles) {
			if (file instanceof TFolder) {
				if (!inputStr || file.path.toLowerCase().includes(lowerInputStr)) {
					folders.push(file);
				}
			}
		}

		return folders.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.textComponent.setValue(folder.path);
		this.onSelectCallback(folder.path);
		this.close();
	}
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
	private textComponent: TextComponent;
	private onSelectCallback: (value: string) => void;

	constructor(app: App, textComponent: TextComponent, onSelectCallback: (value: string) => void) {
		super(app, textComponent.inputEl);
		this.textComponent = textComponent;
		this.onSelectCallback = onSelectCallback;
	}

	getSuggestions(inputStr: string): TFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const files: TFile[] = [];
		const lowerInputStr = (inputStr || "").toLowerCase();

		for (const file of abstractFiles) {
			if (file instanceof TFile) {
				if (!inputStr || file.path.toLowerCase().includes(lowerInputStr)) {
					files.push(file);
				}
			}
		}

		return files.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.textComponent.setValue(file.path);
		this.onSelectCallback(file.path);
		this.close();
	}
}

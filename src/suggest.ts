import { AbstractInputSuggest, App, TFolder, TFile } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
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

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
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

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

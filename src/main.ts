import { Plugin, Notice, TFile } from "obsidian";
import { DreamAnalyzerSettings, DEFAULT_SETTINGS } from "./types";
import { DreamAnalyzerSettingTab } from "./settings";
import { analyzeDream } from "./analyzer";
import { createTodayDreamNote, createDreamNoteForDate, DatePickerModal } from "./dreamCreator";
import { updateEntityEmbeddings, clearMemoryCache, getDreamsSubfolder } from "./embeddings";
import { ConfirmResetModal, resetAllDreamData } from "./resetManager";
import { getOpenAiApiKey } from "./api";
import { t } from "./i18n";

export default class DreamAnalyzerPlugin extends Plugin {
	settings: DreamAnalyzerSettings;

	async onload() {
		await this.loadSettings();

		this.app.workspace.onLayoutReady(() => {
			const appWithPlugins = this.app as unknown as { plugins?: { enabledPlugins?: Set<string> } };
			if (appWithPlugins.plugins?.enabledPlugins && !appWithPlugins.plugins.enabledPlugins.has("dataview")) {
				new Notice(t("dataviewNotice"), 8000);
			}
		});

		// Ribbon icon for quick dream analysis
		this.addRibbonIcon("sparkles", t("ribbonAnalyze"), () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				void analyzeDream(this.app, activeFile, this.settings);
			} else {
				new Notice(t("openDreamNoteFirst"));
			}
		});

		// Ribbon icon for creating dream note for today
		this.addRibbonIcon("calendar-plus", t("ribbonCreateDream"), () => {
			void createTodayDreamNote(this.app, this.settings);
		});

		// Command 1: Analyze current active dream note
		this.addCommand({
			id: "analyze-current-dream",
			name: t("cmdAnalyze"),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				const dreamsSubfolder = getDreamsSubfolder(this.app, this.settings);
				const isDreamFile = activeFile instanceof TFile && activeFile.extension === "md" && activeFile.path.startsWith(dreamsSubfolder);

				if (isDreamFile) {
					if (!checking) {
						void analyzeDream(this.app, activeFile, this.settings);
					}
					return true;
				}
				return false;
			}
		});

		// Command 2: Create dream note for today
		this.addCommand({
			id: "create-today-dream-note",
			name: t("cmdCreateDream"),
			callback: () => {
				void createTodayDreamNote(this.app, this.settings);
			}
		});

		// Command 3: Create dream note for custom selected date
		this.addCommand({
			id: "create-custom-date-dream-note",
			name: t("cmdCreateDreamDate"),
			callback: () => {
				new DatePickerModal(this.app, (selectedDate: string) => {
					void createDreamNoteForDate(this.app, this.settings, selectedDate);
				}).open();
			}
		});

		// Command 4: Manual entity embeddings update
		this.addCommand({
			id: "rebuild-entity-embeddings",
			name: t("cmdRebuildEmbeddings"),
			callback: () => {
				void (async () => {
					try {
						const apiKey = await getOpenAiApiKey(this.app, this.settings);
						new Notice("Розпочато пакетне оновлення ембедінгів...");
						const count = await updateEntityEmbeddings(this.app, apiKey, this.settings, true);
						new Notice(`Оновлено ембедінгів для ${count} сутностей!`);
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						new Notice("Помилка оновлення ембедінгів: " + msg);
					}
				})();
			}
		});

		// Command 5: Clear all entities and analysis data
		this.addCommand({
			id: "reset-all-dream-data",
			name: t("cmdResetData"),
			callback: () => {
				new ConfirmResetModal(this.app, () => {
					void resetAllDreamData(this.app, this.settings);
				}).open();
			}
		});

		// Register settings tab
		this.addSettingTab(new DreamAnalyzerSettingTab(this.app, this));
	}

	onunload() {
		clearMemoryCache();
	}

	async loadSettings() {
		const loadedData = (await this.loadData()) as Partial<DreamAnalyzerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

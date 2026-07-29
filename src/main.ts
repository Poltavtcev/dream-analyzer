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
			name: t("cmdCreateCustomDateDream"),
			callback: () => {
				new DatePickerModal(this.app, (selectedDate: string) => {
					void createDreamNoteForDate(this.app, this.settings, selectedDate);
				}).open();
			}
		});

		// Command 4: Rebuild vector embeddings for entities
		this.addCommand({
			id: "rebuild-entity-embeddings",
			name: t("cmdRebuildEmbeddings"),
			callback: () => {
				void (async () => {
					try {
						const apiKey = await getOpenAiApiKey(this.app, this.settings);
						const notice = new Notice(t("rebuildStart"), 0);
						const count = await updateEntityEmbeddings(this.app, apiKey, this.settings, true);
						notice.hide();
						new Notice(t("rebuildSuccess", { count }));
					} catch (e: unknown) {
						const msg = e instanceof Error ? e.message : String(e);
						new Notice("Помилка: " + msg);
					}
				})();
			}
		});

		// Command 5: Reset all analyzed data and entities
		this.addCommand({
			id: "reset-all-data",
			name: t("cmdResetAllData"),
			callback: () => {
				new ConfirmResetModal(this.app, () => {
					void (async () => {
						try {
							const notice = new Notice("Очищення даних...", 0);
							const res = await resetAllDreamData(this.app, this.settings);
							notice.hide();
							new Notice(t("resetSuccess", { dreams: res.dreamsReset, entities: res.entitiesDeleted }));
						} catch (e: unknown) {
							const msg = e instanceof Error ? e.message : String(e);
							new Notice("Помилка очищення: " + msg);
						}
					})();
				}).open();
			}
		});

		// Context menu item restricted STRICTLY to dream files inside the 'Сни' / 'Dreams' subfolder
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const dreamsSubfolder = getDreamsSubfolder(this.app, this.settings);
				if (file instanceof TFile && file.extension === "md" && file.path.startsWith(dreamsSubfolder)) {
					menu.addItem((item) => {
						item
							.setTitle(t("contextMenuAnalyze"))
							.setIcon("sparkles")
							.onClick(() => {
								void analyzeDream(this.app, file, this.settings);
							});
					});
				}
			})
		);

		// Settings Tab
		this.addSettingTab(new DreamAnalyzerSettingTab(this.app, this));
	}

	onunload() {
		// Clean unload
	}

	async loadSettings() {
		const rawData = (await this.loadData()) as Partial<DreamAnalyzerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, rawData || {});
		clearMemoryCache();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		clearMemoryCache();
	}
}

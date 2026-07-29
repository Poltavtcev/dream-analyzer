import { Plugin, TFile, Notice } from "obsidian";
import { DreamAnalyzerSettings, DEFAULT_SETTINGS } from "./types";
import { analyzeDream } from "./analyzer";
import { createTodayDreamNote, createDreamNoteForDate, DatePickerModal } from "./dreamCreator";
import { updateEntityEmbeddings, clearMemoryCache, handleFileRename, getDreamsSubfolder } from "./embeddings";
import { DreamAnalyzerSettingTab } from "./settings";
import { ConfirmResetModal, resetAllDreamData } from "./resetManager";
import { getOpenAiApiKey } from "./api";
import { t } from "./i18n";

export default class DreamAnalyzerPlugin extends Plugin {
	settings: DreamAnalyzerSettings;

	async onload() {
		await this.loadSettings();

		// Add Ribbon Icons
		this.addRibbonIcon("brain", t("ribbonAnalyze"), () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile instanceof TFile && activeFile.extension === "md") {
				void analyzeDream(this.app, activeFile, this.settings);
			} else {
				new Notice(t("openDreamNoteFirst"));
			}
		});

		this.addRibbonIcon("calendar-plus", t("ribbonCreateDream"), () => {
			void createTodayDreamNote(this.app, this.settings);
		});

		// Listen to note rename events
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					void handleFileRename(this.app, file, oldPath, this.settings);
				}
			})
		);

		// Command 1: Analyze active dream note
		this.addCommand({
			id: "analyze-dream",
			name: t("cmdAnalyze"),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile instanceof TFile && activeFile.extension === "md") {
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
			id: "create-today-dream",
			name: t("cmdCreateDream"),
			callback: () => {
				void createTodayDreamNote(this.app, this.settings);
			}
		});

		// Command 3: Create dream note for custom date
		this.addCommand({
			id: "create-custom-date-dream",
			name: t("cmdCreateCustomDateDream"),
			callback: () => {
				new DatePickerModal(this.app, (selectedDate) => {
					void createDreamNoteForDate(this.app, this.settings, selectedDate);
				}).open();
			}
		});

		// Command 4: Rebuild/update entity embeddings database
		this.addCommand({
			id: "rebuild-embeddings",
			name: t("cmdRebuildEmbeddings"),
			callback: () => {
				void (async () => {
					try {
						const apiKey = await getOpenAiApiKey(this.app, this.settings);
						const notice = new Notice(t("rebuildStart"), 0);
						const count = await updateEntityEmbeddings(this.app, apiKey, this.settings, true);
						notice.hide();
						new Notice(t("rebuildSuccess", { count }));
					} catch (e: any) {
						new Notice("Помилка: " + (e.message || e));
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
						} catch (e: any) {
							new Notice("Помилка очищення: " + (e.message || e));
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
						item.setTitle(t("contextMenuAnalyze"))
							.setIcon("brain")
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		clearMemoryCache();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		clearMemoryCache();
	}
}

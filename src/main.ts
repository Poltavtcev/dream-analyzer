import { Plugin, TFile, Notice } from "obsidian";
import { DreamAnalyzerSettings, DEFAULT_SETTINGS } from "./types";
import { DreamAnalyzerSettingTab } from "./settings";
import { analyzeDream } from "./analyzer";
import { updateEntityEmbeddings, clearMemoryCache, handleFileRename } from "./embeddings";
import { createTodayDreamNote, createDreamNoteForDate, DatePickerModal, ensureDreamDashboard, ensureEntityIndexes } from "./dreamCreator";
import { ConfirmResetModal, resetAllDreamData } from "./resetManager";
import { getOpenAiApiKey } from "./api";
import { t } from "./i18n";

export default class DreamAnalyzerPlugin extends Plugin {
	settings: DreamAnalyzerSettings;

	async onload() {
		await this.loadSettings();

		// Auto-ensure Dashboard & Entity Indexes exist
		this.app.workspace.onLayoutReady(async () => {
			try {
				await ensureEntityIndexes(this.app, this.settings);
				await ensureDreamDashboard(this.app, this.settings);
			} catch (e) {
				console.warn("Could not ensure dream dashboard/indexes:", e);
			}
		});

		// Auto-sync vector database paths on file rename in Obsidian
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (file instanceof TFile) {
					await handleFileRename(this.app, this.settings, file, oldPath);
				}
			})
		);

		// Ribbon Icon 1: Analyze active dream
		this.addRibbonIcon("brain", t("ribbonAnalyze"), async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile instanceof TFile && activeFile.extension === "md") {
				await analyzeDream(this.app, activeFile, this.settings);
			} else {
				new Notice(t("openDreamNoteFirst"));
			}
		});

		// Ribbon Icon 2: Create today's dream note
		this.addRibbonIcon("calendar-plus", t("ribbonCreateDream"), async () => {
			await createTodayDreamNote(this.app, this.settings);
		});

		// Command 1: Analyze active dream note
		this.addCommand({
			id: "analyze-dream",
			name: t("cmdAnalyze"),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile instanceof TFile && activeFile.extension === "md") {
					if (!checking) {
						analyzeDream(this.app, activeFile, this.settings);
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
			callback: async () => {
				await createTodayDreamNote(this.app, this.settings);
			}
		});

		// Command 3: Create dream note for custom date
		this.addCommand({
			id: "create-custom-date-dream",
			name: t("cmdCreateCustomDateDream"),
			callback: () => {
				new DatePickerModal(this.app, async (selectedDate) => {
					await createDreamNoteForDate(this.app, this.settings, selectedDate);
				}).open();
			}
		});

		// Command 4: Rebuild/update entity embeddings database
		this.addCommand({
			id: "rebuild-embeddings",
			name: t("cmdRebuildEmbeddings"),
			callback: async () => {
				try {
					const apiKey = await getOpenAiApiKey(this.app, this.settings);
					const notice = new Notice(t("rebuildStart"), 0);
					const count = await updateEntityEmbeddings(this.app, apiKey, this.settings, true);
					notice.hide();
					new Notice(t("rebuildSuccess", { count }));
				} catch (e: any) {
					new Notice("Помилка: " + (e.message || e));
				}
			}
		});

		// Command 5: Reset all analyzed data and entities
		this.addCommand({
			id: "reset-all-data",
			name: t("cmdResetAllData"),
			callback: () => {
				new ConfirmResetModal(this.app, async () => {
					try {
						const notice = new Notice("Очищення даних...", 0);
						const res = await resetAllDreamData(this.app, this.settings);
						notice.hide();
						new Notice(t("resetSuccess", { dreams: res.dreamsReset, entities: res.entitiesDeleted }));
					} catch (e: any) {
						new Notice("Помилка очищення: " + (e.message || e));
					}
				}).open();
			}
		});

		// Context menu item restricted ONLY to files inside dreamsFolder
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const dreamsFolder = (this.settings?.dreamsFolder || "Dreams").trim().replace(/\/$/, "");
				if (file instanceof TFile && file.extension === "md" && file.path.startsWith(dreamsFolder)) {
					menu.addItem((item) => {
						item.setTitle(t("contextMenuAnalyze"))
							.setIcon("brain")
							.onClick(async () => {
								await analyzeDream(this.app, file, this.settings);
							});
					});
				}
			})
		);

		// Settings Tab
		this.addSettingTab(new DreamAnalyzerSettingTab(this.app, this));
		console.log("Dream Analyzer Plugin loaded");
	}

	onunload() {
		console.log("Dream Analyzer Plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		clearMemoryCache();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		clearMemoryCache();
		try {
			await ensureEntityIndexes(this.app, this.settings);
			await ensureDreamDashboard(this.app, this.settings);
		} catch (e) {
			console.warn("Could not ensure dream dashboard/indexes on saveSettings:", e);
		}
	}
}

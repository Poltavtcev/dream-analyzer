import { App, PluginSettingTab, Setting, Notice, normalizePath } from "obsidian";
import DreamAnalyzerPlugin from "./main";
import { updateEntityEmbeddings } from "./embeddings";
import { exportTemplaterTemplate, ensureDreamDashboard, ensureEntityIndexes } from "./dreamCreator";
import { ConfirmResetModal, resetAllDreamData } from "./resetManager";
import { getOpenAiApiKey } from "./api";
import { FolderSuggest, FileSuggest } from "./suggest";
import { t } from "./i18n";

export class DreamAnalyzerSettingTab extends PluginSettingTab {
	plugin: DreamAnalyzerPlugin;

	constructor(app: App, plugin: DreamAnalyzerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): unknown[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName(t("settingsTitle")).setHeading();

		// API Key Setting: SecretStorage SecretComponent with Password Text fallback
		const winObj = window as unknown as Record<string, Record<string, unknown>>;
		const SecretComp = winObj.Obsidian ? winObj.Obsidian.SecretComponent : undefined;
		const appWithSecret = this.app as App & { secretStorage?: unknown };
		const hasSecretStorage = typeof SecretComp === "function" && typeof appWithSecret.secretStorage !== "undefined";

		if (hasSecretStorage && typeof SecretComp === "function") {
			const setting = new Setting(containerEl)
				.setName(t("apiKeyName"))
				.setDesc(t("apiKeyDesc"));
			const comp = new (SecretComp as new (app: App, el: HTMLElement) => { setValue(v: string): unknown; onChange(cb: (v: string) => void): unknown })(this.app, setting.controlEl);
			comp
				.setValue(this.plugin.settings.openaiApiKey || "");
			comp.onChange((value: string) => {
				void (async () => {
					this.plugin.settings.openaiApiKey = value ? value.trim() : "";
					await this.plugin.saveSettings();
				})();
			});
		} else {
			new Setting(containerEl)
				.setName(t("apiKeyName"))
				.setDesc(t("apiKeyDesc"))
				.addText(text => {
					text.inputEl.type = "password";
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.openaiApiKey || "")
						.onChange((value) => {
							void (async () => {
								this.plugin.settings.openaiApiKey = value.trim();
								await this.plugin.saveSettings();
							})();
						});
				});
		}

		// Model Selection
		new Setting(containerEl)
			.setName(t("modelName"))
			.setDesc(t("modelDesc"))
			.addDropdown(dropdown => dropdown
				.addOption("gpt-5-mini", t("gptDefaultLabel"))
				.addOption("gpt-4.1-mini", "GPT-4.1 mini")
				.addOption("gpt-5", "GPT-5")
				.addOption("gpt-4o-mini", "GPT-4o mini")
				.addOption("gpt-4o", "GPT-4o")
				.addOption("o3-mini", "o3-mini")
				.setValue(this.plugin.settings.openaiModel || "gpt-5-mini")
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.openaiModel = value;
						await this.plugin.saveSettings();
					})();
				}));

		new Setting(containerEl).setName(t("sectionJournalFolder")).setHeading();

		// Dreams folder (Main Root Folder)
		new Setting(containerEl)
			.setName(t("dreamsFolderName"))
			.setDesc(t("dreamsFolderDesc"))
			.addText(text => {
				const applyFolderChange = async (val: string) => {
					const cleaned = normalizePath(val.trim());
					if (cleaned) {
						this.plugin.settings.dreamsFolder = cleaned;
						await this.plugin.saveSettings();
						try {
							await ensureEntityIndexes(this.app, this.plugin.settings);
							await ensureDreamDashboard(this.app, this.plugin.settings);
						} catch (e: unknown) {
							console.warn("Could not ensure dream dashboard/indexes on folder change:", e);
						}
					}
				};

				new FolderSuggest(this.app, text, (val) => {
					text.setValue(val);
					void applyFolderChange(val);
				});

				text
					.setPlaceholder("Dreams")
					.setValue(this.plugin.settings.dreamsFolder)
					.onChange((value) => {
						void (async () => {
							this.plugin.settings.dreamsFolder = normalizePath(value.trim());
							await this.plugin.saveSettings();
						})();
					});

				text.inputEl.addEventListener("blur", () => {
					void applyFolderChange(text.getValue());
				});
			});

		new Setting(containerEl).setName(t("templateExportName")).setHeading();

		new Setting(containerEl)
			.setName(t("templatePathName"))
			.setDesc(t("templatePathDesc"))
			.addText(text => {
				new FileSuggest(this.app, text, (val) => {
					void (async () => {
						this.plugin.settings.templateFilePath = normalizePath(val.trim());
						await this.plugin.saveSettings();
					})();
				});
				text
					.setPlaceholder("Templates/Dream Template.md")
					.setValue(this.plugin.settings.templateFilePath || "Templates/Dream Template.md")
					.onChange((value) => {
						void (async () => {
							this.plugin.settings.templateFilePath = normalizePath(val.trim());
							await this.plugin.saveSettings();
						})();
					});
			});

		new Setting(containerEl)
			.setName(t("templateExportName"))
			.setDesc(t("templateExportDesc"))
			.addButton(button => button
				.setButtonText(t("templateExportButtonText"))
				.setCta()
				.onClick(() => {
					void (async () => {
						try {
							await exportTemplaterTemplate(this.app, this.plugin.settings);
						} catch (e: unknown) {
							const msg = e instanceof Error ? e.message : String(e);
							new Notice("Помилка створення шаблону: " + msg);
						}
					})();
				}));

		new Setting(containerEl).setName(t("sectionVectorSearch")).setHeading();

		new Setting(containerEl)
			.setName(t("autoEmbeddingsName"))
			.setDesc(t("autoEmbeddingsDesc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateEmbeddings)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.autoUpdateEmbeddings = value;
						await this.plugin.saveSettings();
					})();
				}));

		new Setting(containerEl)
			.setName(t("embeddingModelName"))
			.setDesc(t("embeddingModelDesc"))
			.addText(text => text
				.setPlaceholder("text-embedding-3-small")
				.setValue(this.plugin.settings.embeddingModel)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.embeddingModel = value.trim();
						await this.plugin.saveSettings();
					})();
				}));

		new Setting(containerEl)
			.setName(t("thresholdName"))
			.setDesc(t("thresholdDesc"))
			.addText(text => text
				.setPlaceholder("0.35")
				.setValue(String(this.plugin.settings.similarityThreshold))
				.onChange((value) => {
					void (async () => {
						const val = parseFloat(value);
						if (!isNaN(val) && val >= 0 && val <= 1) {
							this.plugin.settings.similarityThreshold = val;
							await this.plugin.saveSettings();
						}
					})();
				}));

		new Setting(containerEl)
			.setName(t("limitName"))
			.setDesc(t("limitDesc"))
			.addText(text => text
				.setPlaceholder("40")
				.setValue(String(this.plugin.settings.similarityLimit))
				.onChange((value) => {
					void (async () => {
						const val = parseInt(value, 10);
						if (!isNaN(val) && val > 0) {
							this.plugin.settings.similarityLimit = val;
							await this.plugin.saveSettings();
						}
					})();
				}));

		new Setting(containerEl)
			.setName(t("rebuildButtonName"))
			.setDesc(t("rebuildButtonDesc"))
			.addButton(button => button
				.setButtonText(t("rebuildButtonText"))
				.onClick(() => {
					void (async () => {
						try {
							const apiKey = await getOpenAiApiKey(this.app, this.plugin.settings);
							const notice = new Notice(t("rebuildStart"), 0);
							const count = await updateEntityEmbeddings(this.app, apiKey, this.plugin.settings, true);
							notice.hide();
							new Notice(t("rebuildSuccess", { count }));
						} catch (e: unknown) {
							const msg = e instanceof Error ? e.message : String(e);
							new Notice("Помилка: " + msg);
						}
					})();
				}));

		new Setting(containerEl).setName(t("resetSectionTitle")).setHeading();

		new Setting(containerEl)
			.setName(t("resetSectionTitle"))
			.setDesc(t("resetSectionDesc"))
			.addButton(button => {
				button.setButtonText(t("resetButtonText"));
				const btnRecord = button as unknown as Record<string, unknown>;
				if (typeof btnRecord.setDestructive === "function") {
					(btnRecord.setDestructive as (val: boolean) => void)(true);
				} else if (typeof btnRecord.setWarning === "function") {
					(btnRecord.setWarning as () => void)();
				}
				button.onClick(() => {
					new ConfirmResetModal(this.app, () => {
						void (async () => {
							try {
								const notice = new Notice("Очищення даних...", 0);
								const res = await resetAllDreamData(this.app, this.plugin.settings);
								notice.hide();
								new Notice(t("resetSuccess", { dreams: res.dreamsReset, entities: res.entitiesDeleted }));
							} catch (e: unknown) {
								const msg = e instanceof Error ? e.message : String(e);
								new Notice("Помилка очищення: " + msg);
							}
						})();
					}).open();
				});
			});
	}
}

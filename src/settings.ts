import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import DreamAnalyzerPlugin from "./main";
import { updateEntityEmbeddings } from "./embeddings";
import { exportTemplaterTemplate } from "./dreamCreator";
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: t("settingsTitle") });

		// API Key Setting
		new Setting(containerEl)
			.setName(t("apiKeyName"))
			.setDesc(t("apiKeyDesc"))
			.addText(text => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		// Model Selection
		new Setting(containerEl)
			.setName(t("modelName"))
			.setDesc(t("modelDesc"))
			.addDropdown(dropdown => dropdown
				.addOption("gpt-5-mini", "GPT-5 mini (За замовчуванням / Default)")
				.addOption("gpt-4.1-mini", "GPT-4.1 mini")
				.addOption("gpt-5", "GPT-5")
				.addOption("gpt-4o-mini", "GPT-4o mini")
				.addOption("gpt-4o", "GPT-4o")
				.addOption("o3-mini", "o3-mini")
				.setValue(this.plugin.settings.openaiModel || "gpt-5-mini")
				.onChange(async (value) => {
					this.plugin.settings.openaiModel = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl("h3", { text: "Папки снів та сутностей / Folders" });

		// Dreams folder
		new Setting(containerEl)
			.setName(t("dreamsFolderName"))
			.setDesc(t("dreamsFolderDesc"))
			.addText(text => {
				new FolderSuggest(this.app, text, async (val) => {
					this.plugin.settings.dreamsFolder = val.trim().replace(/\/$/, "");
					await this.plugin.saveSettings();
				});
				text
					.setPlaceholder("Dreams")
					.setValue(this.plugin.settings.dreamsFolder)
					.onChange(async (value) => {
						this.plugin.settings.dreamsFolder = value.trim().replace(/\/$/, "");
						await this.plugin.saveSettings();
					});
			});

		// Entities folder
		new Setting(containerEl)
			.setName(t("entitiesFolderName"))
			.setDesc(t("entitiesFolderDesc"))
			.addText(text => {
				new FolderSuggest(this.app, text, async (val) => {
					this.plugin.settings.entitiesFolder = val.trim().replace(/\/$/, "");
					await this.plugin.saveSettings();
				});
				text
					.setPlaceholder("Entities")
					.setValue(this.plugin.settings.entitiesFolder)
					.onChange(async (value) => {
						this.plugin.settings.entitiesFolder = value.trim().replace(/\/$/, "");
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: t("templateExportName") });

		new Setting(containerEl)
			.setName(t("templatePathName"))
			.setDesc(t("templatePathDesc"))
			.addText(text => {
				new FileSuggest(this.app, text, async (val) => {
					this.plugin.settings.templateFilePath = val.trim();
					await this.plugin.saveSettings();
				});
				text
					.setPlaceholder("Templates/Dream Template.md")
					.setValue(this.plugin.settings.templateFilePath || "Templates/Dream Template.md")
					.onChange(async (value) => {
						this.plugin.settings.templateFilePath = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("templateExportName"))
			.setDesc(t("templateExportDesc"))
			.addButton(button => button
				.setButtonText(t("templateExportButtonText"))
				.setCta()
				.onClick(async () => {
					try {
						await exportTemplaterTemplate(this.app, this.plugin.settings);
					} catch (e: any) {
						new Notice("Помилка створення шаблону: " + (e.message || e));
					}
				}));

		containerEl.createEl("h3", { text: "Векторний пошук та Ембедінги / Vector Search" });

		new Setting(containerEl)
			.setName(t("autoEmbeddingsName"))
			.setDesc(t("autoEmbeddingsDesc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateEmbeddings)
				.onChange(async (value) => {
					this.plugin.settings.autoUpdateEmbeddings = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("embeddingModelName"))
			.setDesc(t("embeddingModelDesc"))
			.addText(text => text
				.setPlaceholder("text-embedding-3-small")
				.setValue(this.plugin.settings.embeddingModel)
				.onChange(async (value) => {
					this.plugin.settings.embeddingModel = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("thresholdName"))
			.setDesc(t("thresholdDesc"))
			.addText(text => text
				.setPlaceholder("0.35")
				.setValue(String(this.plugin.settings.similarityThreshold))
				.onChange(async (value) => {
					const val = parseFloat(value);
					if (!isNaN(val) && val >= 0 && val <= 1) {
						this.plugin.settings.similarityThreshold = val;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName(t("limitName"))
			.setDesc(t("limitDesc"))
			.addText(text => text
				.setPlaceholder("40")
				.setValue(String(this.plugin.settings.similarityLimit))
				.onChange(async (value) => {
					const val = parseInt(value, 10);
					if (!isNaN(val) && val > 0) {
						this.plugin.settings.similarityLimit = val;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName(t("rebuildButtonName"))
			.setDesc(t("rebuildButtonDesc"))
			.addButton(button => button
				.setButtonText(t("rebuildButtonText"))
				.onClick(async () => {
					try {
						const apiKey = await getOpenAiApiKey(this.app, this.plugin.settings);
						const notice = new Notice(t("rebuildStart"), 0);
						const count = await updateEntityEmbeddings(this.app, apiKey, this.plugin.settings, false);
						notice.hide();
						new Notice(t("rebuildSuccess", { count }));
					} catch (e: any) {
						new Notice("Помилка: " + (e.message || e));
					}
				}));

		containerEl.createEl("h3", { text: t("resetSectionTitle") });

		new Setting(containerEl)
			.setName(t("resetSectionTitle"))
			.setDesc(t("resetSectionDesc"))
			.addButton(button => button
				.setButtonText(t("resetButtonText"))
				.setWarning()
				.onClick(() => {
					new ConfirmResetModal(this.app, async () => {
						try {
							const notice = new Notice("Очищення даних...", 0);
							const res = await resetAllDreamData(this.app, this.plugin.settings);
							notice.hide();
							new Notice(t("resetSuccess", { dreams: res.dreamsReset, entities: res.entitiesDeleted }));
						} catch (e: any) {
							new Notice("Помилка очищення: " + (e.message || e));
						}
					}).open();
				}));
	}
}

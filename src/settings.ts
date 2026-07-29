import { App, PluginSettingTab, Setting, Notice, normalizePath } from "obsidian";
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

	getSettingDefinitions(): unknown[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Title
		const titleSetting = new Setting(containerEl).setName(t("settingsTitle"));
		titleSetting.settingEl.addClass("setting-item-heading");

		// 1. OpenAI API Key Setting (Stacked Layout)
		const apiKeySetting = new Setting(containerEl)
			.setName(t("apiKeyName"))
			.setDesc(t("apiKeyDesc"));

		apiKeySetting.settingEl.setCssStyles({ display: "flex", flexDirection: "column", alignItems: "stretch" });
		apiKeySetting.controlEl.setCssStyles({ marginTop: "8px", display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" });

		// Text input for sk-... key or secret name
		apiKeySetting.addText(text => {
			text.inputEl.type = "password";
			text.inputEl.setCssStyles({ flex: "1", minWidth: "200px" });
			text
				.setPlaceholder("sk-... або ім'я секрету з SecretStorage")
				.setValue(this.plugin.settings.openaiApiKey || "")
				.onChange((value: string) => {
					this.plugin.settings.openaiApiKey = value.trim();
					void this.plugin.saveSettings();
				});
		});

		// Dropdown for selecting saved secrets from SecretStorage
		apiKeySetting.addDropdown(async (dropdown) => {
			dropdown.addOption("", "-- Обрати ключ із SecretStorage --");

			const secretList: string[] = [];
			const appObj = this.app as unknown as Record<string, unknown>;
			const secretStorage = appObj ? (appObj["secretStorage"] as Record<string, unknown> | undefined) : undefined;

			if (secretStorage) {
				if (typeof secretStorage["listSecrets"] === "function") {
					try {
						const res = await (secretStorage["listSecrets"] as () => Promise<string[]>)();
						if (Array.isArray(res)) secretList.push(...res);
					} catch {
						// Ignore listSecrets error
					}
				}
				if (typeof secretStorage["getSecrets"] === "function") {
					try {
						const res = await (secretStorage["getSecrets"] as () => Promise<string[]>)();
						if (Array.isArray(res)) secretList.push(...res);
					} catch {
						// Ignore getSecrets error
					}
				}
				if (secretStorage["secrets"] && typeof secretStorage["secrets"] === "object") {
					try {
						const secretObj = secretStorage["secrets"] as Record<string, unknown>;
						secretList.push(...Object.keys(secretObj));
					} catch {
						// Ignore keys error
					}
				}
			}

			const uniqueSecrets = Array.from(new Set(secretList)).filter(Boolean);
			if (uniqueSecrets.length > 0) {
				for (const sec of uniqueSecrets) {
					dropdown.addOption(sec, sec);
				}
				const curVal = this.plugin.settings.openaiApiKey || "";
				if (uniqueSecrets.includes(curVal)) {
					dropdown.setValue(curVal);
				}
			} else {
				dropdown.addOption("OPENAI_API_KEY", "OPENAI_API_KEY (Приклад секрету)");
			}

			dropdown.onChange((val: string) => {
				if (val) {
					this.plugin.settings.openaiApiKey = val;
					void this.plugin.saveSettings();
					const inputEl = apiKeySetting.controlEl.querySelector("input");
					if (inputEl) inputEl.value = val;
				}
			});
		});

		// 2. OpenAI Model Selection
		new Setting(containerEl)
			.setName(t("modelName"))
			.setDesc(t("modelDesc"))
			.addDropdown(dropdown => dropdown
				.addOption("gpt-5-mini", "GPT-5 Mini (Fast & Smart)")
				.addOption("gpt-4o-mini", "GPT-4o Mini (Default)")
				.addOption("gpt-4o", "GPT-4o (High Accuracy)")
				.setValue(this.plugin.settings.openaiModel || "gpt-5-mini")
				.onChange((value: string) => {
					this.plugin.settings.openaiModel = value;
					void this.plugin.saveSettings();
				}));

		// 3. Embedding Model Selection
		new Setting(containerEl)
			.setName(t("embeddingModelName"))
			.setDesc(t("embeddingModelDesc"))
			.addDropdown(dropdown => dropdown
				.addOption("text-embedding-3-small", "text-embedding-3-small (Default)")
				.addOption("text-embedding-3-large", "text-embedding-3-large (High Precision)")
				.addOption("text-embedding-ada-002", "text-embedding-ada-002 (Legacy)")
				.setValue(this.plugin.settings.embeddingModel || "text-embedding-3-small")
				.onChange((value: string) => {
					this.plugin.settings.embeddingModel = value;
					void this.plugin.saveSettings();
				}));

		// 4. Section: Folders & Paths
		const folderHeading = new Setting(containerEl).setName(t("sectionFolders"));
		folderHeading.settingEl.addClass("setting-item-heading");

		new Setting(containerEl)
			.setName(t("dreamsFolderName"))
			.setDesc(t("dreamsFolderDesc"))
			.addText(text => {
				text
					.setPlaceholder("Dreams")
					.setValue(this.plugin.settings.dreamsFolder)
					.onChange((value: string) => {
						const cleanVal = normalizePath(value.trim() || "Dreams");
						this.plugin.settings.dreamsFolder = cleanVal;
						void this.plugin.saveSettings();
					});

				new FolderSuggest(this.app, text.inputEl);
			});

		// Template File Path (Stacked Layout)
		const templateSetting = new Setting(containerEl)
			.setName(t("templatePathName"))
			.setDesc(t("templatePathDesc"));

		templateSetting.settingEl.setCssStyles({ display: "flex", flexDirection: "column", alignItems: "stretch" });
		templateSetting.controlEl.setCssStyles({ marginTop: "8px", display: "flex", gap: "8px", width: "100%" });

		templateSetting
			.addText(text => {
				text.inputEl.setCssStyles({ flex: "1", minWidth: "200px" });
				text
					.setPlaceholder("Templates/Dream Template.md")
					.setValue(this.plugin.settings.templateFilePath)
					.onChange((value: string) => {
						const cleanVal = normalizePath(value.trim() || "Templates/Dream Template.md");
						this.plugin.settings.templateFilePath = cleanVal;
						void this.plugin.saveSettings();
					});

				new FileSuggest(this.app, text.inputEl);
			})
			.addButton(btn => btn
				.setButtonText(t("btnExportTemplate"))
				.onClick(async () => {
					await exportTemplaterTemplate(this.app, this.plugin.settings);
				}));

		// 5. Section: Similarity Parameters
		const simHeading = new Setting(containerEl).setName(t("sectionSimilarity"));
		simHeading.settingEl.addClass("setting-item-heading");

		new Setting(containerEl)
			.setName(t("thresholdName"))
			.setDesc(t("thresholdDesc"))
			.addText(text => {
				text.inputEl.type = "number";
				text.inputEl.step = "0.05";
				text.inputEl.min = "0";
				text.inputEl.max = "1";
				text
					.setValue(String(this.plugin.settings.similarityThreshold))
					.onChange((value: string) => {
						const val = parseFloat(value);
						if (!isNaN(val) && val >= 0 && val <= 1) {
							this.plugin.settings.similarityThreshold = val;
							void this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName(t("limitName"))
			.setDesc(t("limitDesc"))
			.addText(text => {
				text.inputEl.type = "number";
				text.inputEl.step = "1";
				text.inputEl.min = "1";
				text.inputEl.max = "100";
				text
					.setValue(String(this.plugin.settings.similarityLimit))
					.onChange((value: string) => {
						const val = parseInt(value, 10);
						if (!isNaN(val) && val > 0) {
							this.plugin.settings.similarityLimit = val;
							void this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName(t("autoUpdateName"))
			.setDesc(t("autoUpdateDesc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateEmbeddings)
				.onChange((value: boolean) => {
					this.plugin.settings.autoUpdateEmbeddings = value;
					void this.plugin.saveSettings();
				}));

		// 6. Section: Maintenance
		const maintHeading = new Setting(containerEl).setName(t("sectionMaintenance"));
		maintHeading.settingEl.addClass("setting-item-heading");

		new Setting(containerEl)
			.setName(t("btnRebuildEmbeddings"))
			.addButton(btn => btn
				.setButtonText(t("btnRebuildEmbeddings"))
				.onClick(async () => {
					try {
						const apiKey = await getOpenAiApiKey(this.app, this.plugin.settings);
						new Notice("Розпочато пакетне оновлення ембедінгів...");
						const count = await updateEntityEmbeddings(this.app, apiKey, this.plugin.settings, true);
						new Notice(`Оновлено ембедінгів для ${count} сутностей!`);
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						new Notice("Помилка оновлення ембедінгів: " + msg);
					}
				}));

		new Setting(containerEl)
			.setName("Скидання аналітичних даних")
			.setDesc("Видалити всі сутності, оновлені дати та повернути початковий AI-стан снів")
			.addButton(btn => {
				btn.setButtonText("Скинути всі дані");
				btn.buttonEl.addClass("mod-warning");
				btn.onClick(() => {
					new ConfirmResetModal(this.app, () => {
						void resetAllDreamData(this.app, this.plugin.settings);
					}).open();
				});
			});
	}
}

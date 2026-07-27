import { App, Modal, Setting, TFile, Notice } from "obsidian";
import { DreamAnalyzerSettings } from "./types";
import { saveEmbeddingsDatabase, saveDreamEmbeddingsDatabase, getDreamsSubfolder, getEntitiesSubfolder } from "./embeddings";
import { t } from "./i18n";

export class ConfirmResetModal extends Modal {
	private onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: t("resetModalTitle") });
		contentEl.createEl("p", { text: t("resetModalDesc") });

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(t("resetModalConfirmButton"))
				.setWarning()
				.onClick(() => {
					this.close();
					this.onConfirm();
				}))
			.addButton(btn => btn
				.setButtonText(t("resetModalCancelButton"))
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export async function resetAllDreamData(
	app: App,
	settings: DreamAnalyzerSettings
): Promise<{ dreamsReset: number; entitiesDeleted: number }> {
	const dreamsFolder = getDreamsSubfolder(app, settings);
	const entitiesFolder = getEntitiesSubfolder(app, settings);

	let entitiesDeleted = 0;
	let dreamsReset = 0;

	// 1. Видаляємо всі файли сутностей у папці entitiesFolder
	const allFiles = app.vault.getMarkdownFiles();
	const entityFiles = allFiles.filter(f => f.path.startsWith(entitiesFolder));
	for (const file of entityFiles) {
		try {
			await app.vault.delete(file);
			entitiesDeleted++;
		} catch (e) {
			console.error("Could not delete entity file:", file.path, e);
		}
	}

	// 2. Скидаємо нотатки снів до початкового стану (обнуляємо frontmatter і прибираємо AI аналіз)
	const dreamFiles = allFiles.filter(f => f.path.startsWith(dreamsFolder));
	for (const file of dreamFiles) {
		try {
			await app.fileManager.processFrontMatter(file, (fm) => {
				fm.type = "dream";
				fm.entities_checked = false;
				fm.characters = [];
				fm.places = [];
				fm.objects = [];
				fm.emotions = [];
				fm.symbols = [];
				fm.concepts = [];
				fm.keywords = [];
			});

			let content = await app.vault.read(file);
			if (content.includes("# AI аналіз")) {
				content = content.replace(/# AI аналіз[\s\S]*/, "# AI аналіз\n\n## Короткий опис\n\n\n## Можливі зв'язки з попередніми снами\n\n-");
				await app.vault.modify(file, content);
			}

			dreamsReset++;
		} catch (e) {
			console.error("Could not reset dream file:", file.path, e);
		}
	}

	// 3. Очищаємо векторні бази даних (embeddings.json & dream_embeddings.json)
	await saveEmbeddingsDatabase(app, settings, []);
	await saveDreamEmbeddingsDatabase(app, settings, []);

	return { dreamsReset, entitiesDeleted };
}

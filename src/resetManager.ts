import { App, Modal, Setting } from "obsidian";
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
			.addButton(btn => {
				btn.setButtonText(t("resetModalConfirmButton"));
				const btnRecord = btn as unknown as Record<string, unknown>;
				if (typeof btnRecord.setDestructive === "function") {
					(btnRecord.setDestructive as (val: boolean) => void)(true);
				} else if (typeof btnRecord.setWarning === "function") {
					(btnRecord.setWarning as () => void)();
				}
				btn.onClick(() => {
					this.close();
					this.onConfirm();
				});
			})
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

	// 1. Видаляємо всі файли сутностей у папці entitiesFolder через FileManager.trashFile (безпечно до корзини)
	const allFiles = app.vault.getMarkdownFiles();
	const entityFiles = allFiles.filter(f => f.path.startsWith(entitiesFolder));
	for (const file of entityFiles) {
		try {
			await app.fileManager.trashFile(file);
			entitiesDeleted++;
		} catch (e: unknown) {
			console.error("Could not trash entity file:", file.path, e);
		}
	}

	// 2. Скидаємо нотатки снів до початкового стану (обнуляємо frontmatter і прибираємо AI аналіз)
	const dreamFiles = allFiles.filter(f => f.path.startsWith(dreamsFolder));
	for (const file of dreamFiles) {
		try {
			await app.fileManager.processFrontMatter(file, (fmRecord: Record<string, unknown>) => {
				fmRecord["type"] = "dream";
				fmRecord["entities_checked"] = false;
				fmRecord["characters"] = [];
				fmRecord["places"] = [];
				fmRecord["objects"] = [];
				fmRecord["emotions"] = [];
				fmRecord["symbols"] = [];
				fmRecord["concepts"] = [];
				fmRecord["keywords"] = [];
			});

			let content = await app.vault.read(file);
			if (content.includes("# AI аналіз")) {
				content = content.replace(/# AI аналіз[\s\S]*/, "# AI аналіз\n\n## Короткий опис\n\n\n## Можливі зв'язки з попередніми снами\n\n-");
				await app.vault.modify(file, content);
			}

			dreamsReset++;
		} catch (e: unknown) {
			console.error("Could not reset dream file:", file.path, e);
		}
	}

	// 3. Очищаємо векторні бази даних (embeddings.json & dream_embeddings.json)
	await saveEmbeddingsDatabase(app, settings, []);
	await saveDreamEmbeddingsDatabase(app, settings, []);

	return { dreamsReset, entitiesDeleted };
}

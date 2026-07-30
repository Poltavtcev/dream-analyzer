import { App, TFile, Notice } from "obsidian";
import { DreamAnalyzerSettings } from "./types";
import { clearMemoryCache, getDreamsSubfolder, getEntitiesSubfolder, saveEmbeddingsDatabase, saveDreamEmbeddingsDatabase, getFolderMarkdownFiles } from "./embeddings";
import { t } from "./i18n";

export class ConfirmResetModal {
	private app: App;
	private onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		this.app = app;
		this.onConfirm = onConfirm;
	}

	open() {
		const modalContainer = document.createElement("div");
		modalContainer.addClass("modal-container");

		const modalBg = document.createElement("div");
		modalBg.addClass("modal-bg");
		modalContainer.appendChild(modalBg);

		const modalEl = document.createElement("div");
		modalEl.addClass("modal");
		modalEl.setCssStyles({ maxWidth: "500px", padding: "24px" });

		const title = document.createElement("h2");
		title.textContent = t("resetModalTitle");
		modalEl.appendChild(title);

		const desc = document.createElement("p");
		desc.textContent = t("resetModalDesc");
		desc.setCssStyles({ marginTop: "12px", marginBottom: "24px", color: "var(--text-muted)" });
		modalEl.appendChild(desc);

		const buttonContainer = document.createElement("div");
		buttonContainer.setCssStyles({ display: "flex", justifyContent: "flex-end", gap: "12px" });

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = t("resetModalCancelButton");
		cancelBtn.addEventListener("click", () => {
			document.body.removeChild(modalContainer);
		});

		const confirmBtn = document.createElement("button");
		confirmBtn.textContent = t("resetModalConfirmButton");
		confirmBtn.addClass("mod-warning");
		confirmBtn.addEventListener("click", () => {
			document.body.removeChild(modalContainer);
			this.onConfirm();
		});

		buttonContainer.appendChild(cancelBtn);
		buttonContainer.appendChild(confirmBtn);
		modalEl.appendChild(buttonContainer);

		modalContainer.appendChild(modalEl);
		document.body.appendChild(modalContainer);
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
	const entityFiles = getFolderMarkdownFiles(app, entitiesFolder);
	for (const file of entityFiles) {
		try {
			await app.fileManager.trashFile(file);
			entitiesDeleted++;
		} catch (e: unknown) {
			console.error("Could not trash entity file:", file.path, e);
		}
	}

	// 2. Скидаємо нотатки снів до початкового стану (обнуляємо frontmatter і прибираємо AI аналіз)
	const dreamFiles = getFolderMarkdownFiles(app, dreamsFolder);
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
				content = content.replace(/# AI аналіз[\s\S]*/, "");
				await app.vault.modify(file, content.trim());
			} else if (content.includes("# AI Analysis")) {
				content = content.replace(/# AI Analysis[\s\S]*/, "");
				await app.vault.modify(file, content.trim());
			}
			dreamsReset++;
		} catch (e: unknown) {
			console.error("Could not reset dream file:", file.path, e);
		}
	}

	// 3. Очищаємо векторні бази даних
	await saveEmbeddingsDatabase(app, settings, []);
	await saveDreamEmbeddingsDatabase(app, settings, []);
	clearMemoryCache();

	new Notice(t("resetSuccess", { dreams: dreamsReset, entities: entitiesDeleted }));
	return { dreamsReset, entitiesDeleted };
}

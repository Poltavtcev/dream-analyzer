import { App, TFile, Notice, Modal, Setting, moment } from "obsidian";
import { DreamAnalyzerSettings, ENTITY_TYPES } from "./types";
import { t, tList, getLocale } from "./i18n";
import { getDreamsSubfolder, getEntitiesSubfolder } from "./embeddings";

interface TypedMoment {
	format(fmt: string): string;
	day(): number;
	month(): number;
	isValid(): boolean;
}

function getMoment(date?: string | number | Date | string[], format?: string | string[]): TypedMoment {
	const fn = moment as unknown as (d?: unknown, f?: unknown) => TypedMoment;
	return fn(date, format);
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const normalizedPath = path.trim().replace(/\/$/, "");
	if (!app.vault.getAbstractFileByPath(normalizedPath)) {
		await app.vault.createFolder(normalizedPath);
	}
}

export class DatePickerModal extends Modal {
	private onSubmit: (dateStr: string) => void;

	constructor(app: App, onSubmit: (dateStr: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: t("dateModalTitle") });

		let selectedDate = getMoment().format("YYYY-MM-DD");

		new Setting(contentEl)
			.setName(t("dateModalLabel"))
			.addText(text => {
				text.inputEl.type = "date";
				text.setValue(selectedDate);
				text.onChange(value => {
					if (value) selectedDate = value;
				});
			});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(t("dateModalButton"))
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(selectedDate);
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export async function createDreamNoteForDate(
	app: App,
	settings: DreamAnalyzerSettings,
	targetDateInput?: string
): Promise<TFile | void> {
	const now = targetDateInput ? getMoment(targetDateInput, ["YYYY-MM-DD", "D.MM.YYYY", "DD.MM.YYYY"]) : getMoment();
	if (!now.isValid()) {
		new Notice("Некоректний формат дати");
		return;
	}

	const dateStr = now.format("YYYY-MM-DD");
	const dreamsFolder = getDreamsSubfolder(app, settings);
	await ensureFolder(app, dreamsFolder);

	const yearFolder = now.format("YYYY");
	const months = tList("months");
	const monthFolderName = months[now.month()] || now.format("MM");

	const yearFolderPath = `${dreamsFolder}/${yearFolder}`;
	await ensureFolder(app, yearFolderPath);

	const monthFolderPath = `${yearFolderPath}/${monthFolderName}`;
	await ensureFolder(app, monthFolderPath);

	const days = tList("days");
	const dayName = days[now.day()] || "";
	const fileName = `${now.format("D.MM.YYYY")} ${dayName}`.trim();
	const filePath = `${monthFolderPath}/${fileName}.md`;

	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		new Notice(t("dreamAlreadyExists"));
		const leaf = app.workspace.getLeaf(true);
		await leaf.openFile(existingFile);
		return existingFile;
	}

	const templateContent = `---
type: dream
date: ${dateStr}
lucid: false
entities_checked: false
characters: []
places: []
objects: []
emotions: []
symbols: []
concepts: []
keywords: []
---

# Сон

> Введіть сюди свій текст сну...

# AI аналіз

## Короткий опис

-

## Можливі зв'язки з попередніми снами

-
`;

	const newFile = await app.vault.create(filePath, templateContent);
	new Notice(t("dreamCreated"));

	const leaf = app.workspace.getLeaf(true);
	await leaf.openFile(newFile);

	await ensureDreamDashboard(app, settings);
	await ensureEntityIndexes(app, settings);

	return newFile;
}

export async function createTodayDreamNote(
	app: App,
	settings: DreamAnalyzerSettings
): Promise<TFile | void> {
	return await createDreamNoteForDate(app, settings);
}

export async function ensureDreamDashboard(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const dreamsBase = settings.dreamsFolder.trim().replace(/\/$/, "") || "Dreams";
	await ensureFolder(app, dreamsBase);

	const ukDashboardPath = `${dreamsBase}/Дашборд снів.md`;
	const enDashboardPath = `${dreamsBase}/Dream Dashboard.md`;

	const ukFile = app.vault.getAbstractFileByPath(ukDashboardPath);
	const enFile = app.vault.getAbstractFileByPath(enDashboardPath);

	const targetPath = (enFile instanceof TFile) ? enDashboardPath : ukDashboardPath;
	const existingFile = (enFile instanceof TFile) ? enFile : ((ukFile instanceof TFile) ? ukFile : null);

	const dreamsSubfolder = getDreamsSubfolder(app, settings);
	const entitiesSubfolder = getEntitiesSubfolder(app, settings);

	const content = `${t("dashboardTitle")}

${t("dashboardCallout")}

${t("dashboardSectionStats")}

\`\`\`dataview
TABLE WITHOUT ID
length(rows) AS "Всього снів",
length(filter(rows, (r) => r.lucid = true)) AS "Усвідомлених (ОС)",
round(length(filter(rows, (r) => r.lucid = true)) / length(rows) * 100, 1) + "%" AS "% ОС"
FROM "${dreamsSubfolder}"
WHERE type = "dream"
\`\`\`

${t("dashboardSectionSigns")}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Тригер / Поняття",
entity_type AS "Категорія",
dream_count AS "Частота у снах",
last_seen AS "Остання поява"
FROM "${entitiesSubfolder}"
WHERE type = "entity" AND contains(list("character", "place", "symbol", "object"), entity_type)
SORT dream_count DESC
LIMIT 15
\`\`\`

${t("dashboardSectionEmotions")}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Емоція / Стан",
dream_count AS "Появ у снах",
last_seen AS "Останній сон"
FROM "${entitiesSubfolder}"
WHERE entity_type = "emotion"
SORT dream_count DESC
LIMIT 15
\`\`\`

${t("dashboardSectionCreative")}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Ідея / Концепт",
entity_type AS "Тип",
description AS "Опис та сюжетний потенціал",
dream_count AS "Згадок у снах"
FROM "${entitiesSubfolder}"
WHERE type = "entity" AND contains(list("concept", "character", "place"), entity_type) AND length(description) > 0
SORT dream_count DESC
LIMIT 20
\`\`\`

${t("dashboardSectionLucid")}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Сон",
date AS "Дата"
FROM "${dreamsSubfolder}"
WHERE type = "dream" AND lucid = true
SORT date DESC
\`\`\`

${t("dashboardSectionRecent")}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Сон",
date AS "Дата",
choice(lucid, "ОС", "Звичайний") AS "Тип",
characters AS "Персонажі",
places AS "Локації",
concepts AS "Концепти"
FROM "${dreamsSubfolder}"
WHERE type = "dream"
SORT date DESC
LIMIT 10
\`\`\`
`;

	if (existingFile instanceof TFile) {
		await app.vault.modify(existingFile, content);
	} else {
		await app.vault.create(targetPath, content);
	}
}

export async function ensureEntityIndexes(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const baseFolder = getEntitiesSubfolder(app, settings);
	await ensureFolder(app, baseFolder);

	const lang = getLocale();
	const indexFileName = lang === "uk" ? "! Індекс.md" : "! Indexes.md";

	for (const type of ENTITY_TYPES) {
		const categoryFolder = `${baseFolder}/${type.folder}`;
		await ensureFolder(app, categoryFolder);

		const indexPath = `${categoryFolder}/${indexFileName}`;
		const existingFile = app.vault.getAbstractFileByPath(indexPath);

		const indexContent = `# Індекс: ${type.folder}

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Назва",
aliases AS "Аліаси / Синоніми",
description AS "Короткий опис",
dream_count AS "Появ у снах",
last_seen AS "Остання поява"
FROM "${categoryFolder}"
WHERE type = "entity" AND file.name != "${indexFileName.replace(".md", "")}"
SORT dream_count DESC
\`\`\`
`;

		if (existingFile instanceof TFile) {
			await app.vault.modify(existingFile, indexContent);
		} else {
			await app.vault.create(indexPath, indexContent);
		}
	}
}

export async function exportTemplaterTemplate(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const templatePath = (settings.templateFilePath || "Templates/Dream Template.md").trim().replace(/\/$/, "");
	const parentFolder = templatePath.substring(0, templatePath.lastIndexOf("/"));

	if (parentFolder) {
		await ensureFolder(app, parentFolder);
	}

	const content = `---
type: dream
date: <% tp.file.creation_date("YYYY-MM-DD") %>
lucid: false
entities_checked: false
characters: []
places: []
objects: []
emotions: []
symbols: []
concepts: []
keywords: []
---

# Сон

> Введіть сюди свій текст сну...

# AI аналіз

## Короткий опис

-

## Можливі зв'язки з попередніми снами

-
`;

	const existingFile = app.vault.getAbstractFileByPath(templatePath);
	if (existingFile instanceof TFile) {
		await app.vault.modify(existingFile, content);
	} else {
		await app.vault.create(templatePath, content);
	}

	new Notice(t("templateExportSuccess", { path: templatePath }));
}

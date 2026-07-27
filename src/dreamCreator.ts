import { App, TFile, Notice, Modal, Setting, moment } from "obsidian";
import { DreamAnalyzerSettings, ENTITY_TYPES } from "./types";
import { t, getLocale } from "./i18n";
import { getDreamsSubfolder, getEntitiesSubfolder } from "./embeddings";

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

		let selectedDate = (moment as any)().format("YYYY-MM-DD");

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
	const now = targetDateInput ? (moment as any)(targetDateInput, ["YYYY-MM-DD", "D.MM.YYYY", "DD.MM.YYYY"]) : (moment as any)();
	if (!now.isValid()) {
		new Notice("Некоректний формат дати");
		return;
	}

	const year = now.format("YYYY");
	const monthNum = now.format("MM");

	const locale = getLocale();
	const daysUk = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];
	const monthsUk = [
		"01 - січень", "02 - лютий", "03 - березень", "04 - квітень",
		"05 - травень", "06 - червень", "07 - липень", "08 - серпень",
		"09 - вересень", "10 - жовтень", "11 - листопад", "12 - грудень"
	];

	const dayIdx = parseInt(now.format("d"), 10);
	const monthIdx = parseInt(now.format("M"), 10) - 1;

	const dayName = locale === "uk" ? daysUk[dayIdx] : now.format("dddd");
	const monthFolder = locale === "uk" ? monthsUk[monthIdx] : `${monthNum} - ${now.format("MMMM")}`;

	const rootFolder = (settings.dreamsFolder || "Dreams").trim().replace(/\/$/, "");
	const dreamsSubfolder = getDreamsSubfolder(app, settings);

	const yearFolder = `${dreamsSubfolder}/${year}`;
	const folderPath = `${yearFolder}/${monthFolder}`;

	await ensureFolder(app, rootFolder);
	await ensureFolder(app, dreamsSubfolder);
	await ensureFolder(app, yearFolder);
	await ensureFolder(app, folderPath);

	const dateShort = now.format("D.MM.YYYY");
	const dateIso = now.format("YYYY-MM-DD");
	const fileName = `${dateShort} ${dayName}`;
	const filePath = `${folderPath}/${fileName}.md`;

	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		new Notice(t("dreamAlreadyExists"));
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(existingFile);
		return existingFile;
	}

	const initialBody = `# Сон

Текст сну


# AI аналіз

## Короткий опис


## Можливі зв'язки з попередніми снами

-
`;

	const newFile = await app.vault.create(filePath, initialBody);

	await app.fileManager.processFrontMatter(newFile, (fm) => {
		fm.type = "dream";
		fm.date = dateIso;
		fm.lucid = false;
		fm.entities_checked = false;
		fm.characters = [];
		fm.places = [];
		fm.objects = [];
		fm.emotions = [];
		fm.symbols = [];
		fm.concepts = [];
		fm.keywords = [];
	});

	new Notice(t("dreamCreated"));

	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(newFile);
	return newFile;
}

export async function createTodayDreamNote(app: App, settings: DreamAnalyzerSettings): Promise<TFile | void> {
	return createDreamNoteForDate(app, settings);
}

export async function exportTemplaterTemplate(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const templatePath = (settings.templateFilePath || "Templates/Dream Template.md").trim();
	const dreamsSubfolder = getDreamsSubfolder(app, settings);

	const dirIndex = templatePath.lastIndexOf("/");
	if (dirIndex > 0) {
		const dirPath = templatePath.substring(0, dirIndex);
		await ensureFolder(app, dirPath);
	}

	const templaterCode = `<%*
let title = tp.file.title;
let dateObj = window.moment(title, ["YYYY-MM-DD", "D.MM.YYYY", "DD.MM.YYYY"], true);

if (!dateObj.isValid()) {
    const match = String(title || "").match(/\\b(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{2}\\.\\d{4})\\b/);
    if (match) {
        dateObj = window.moment(match[0], ["YYYY-MM-DD", "D.MM.YYYY", "DD.MM.YYYY"]);
    }
}

if (!dateObj || !dateObj.isValid()) {
    dateObj = window.moment();
}

const year = dateObj.format("YYYY");
const monthNum = dateObj.format("MM");

const daysUk = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];
const monthsUk = [
  "01 - січень", "02 - лютий", "03 - березень", "04 - квітень",
  "05 - травень", "06 - червень", "07 - липень", "08 - серпень",
  "09 - вересень", "10 - жовтень", "11 - листопад", "12 - грудень"
];

const dayIdx = parseInt(dateObj.format("d"), 10);
const monthIdx = parseInt(dateObj.format("M"), 10) - 1;

const dayName = daysUk[dayIdx];
const monthFolder = monthsUk[monthIdx];

const baseFolder = "${dreamsSubfolder}";
const yearFolder = \`\${baseFolder}/\${year}\`;
const folder = \`\${yearFolder}/\${monthFolder}\`;

if (!app.vault.getAbstractFileByPath(baseFolder)) {
    await app.vault.createFolder(baseFolder);
}
if (!app.vault.getAbstractFileByPath(yearFolder)) {
    await app.vault.createFolder(yearFolder);
}
if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
}

await tp.file.move(\`\${folder}/\${dateObj.format("D.MM.YYYY")} \${dayName}\`);
-%>---
type: dream
date: <% dateObj.format("YYYY-MM-DD") %>
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

Текст сну


# AI аналіз

## Короткий опис


## Можливі зв'язки з попередніми снами

-
`;

	const existing = app.vault.getAbstractFileByPath(templatePath);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, templaterCode);
	} else {
		await app.vault.create(templatePath, templaterCode);
	}

	new Notice(t("templateExportSuccess", { path: templatePath }));
}

export async function ensureEntityIndexes(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const entitiesFolder = getEntitiesSubfolder(app, settings);
	const locale = getLocale();

	// Check if '! Індекс' or '! Indexes' already exists
	let indexFolderName = locale === "uk" ? "! Індекс" : "! Indexes";
	if (app.vault.getAbstractFileByPath(`${entitiesFolder}/! Індекс`)) {
		indexFolderName = "! Індекс";
	} else if (app.vault.getAbstractFileByPath(`${entitiesFolder}/! Indexes`)) {
		indexFolderName = "! Indexes";
	}

	const indexesFolderPath = `${entitiesFolder}/${indexFolderName}`;
	await ensureFolder(app, indexesFolderPath);

	for (const type of ENTITY_TYPES) {
		const categoryFolder = `${entitiesFolder}/${type.folder}`;
		await ensureFolder(app, categoryFolder);

		let fileName = locale === "uk" ? `Індекс - ${type.folder}.md` : `Index - ${type.folder}.md`;
		const ukFile = `${indexesFolderPath}/Індекс - ${type.folder}.md`;
		const enFile = `${indexesFolderPath}/Index - ${type.folder}.md`;
		if (app.vault.getAbstractFileByPath(ukFile)) {
			fileName = `Індекс - ${type.folder}.md`;
		} else if (app.vault.getAbstractFileByPath(enFile)) {
			fileName = `Index - ${type.folder}.md`;
		}

		const filePath = `${indexesFolderPath}/${fileName}`;

		const title = locale === "uk" ? `Індекс сутностей: ${type.folder}` : `Entity Index: ${type.folder}`;
		const desc = locale === "uk"
			? `Каталог усіх збережених сутностей категорії **${type.folder}** з їхніми описами та частотою появ у снах.`
			: `Catalog of all saved **${type.folder}** entities with descriptions and dream frequency.`;

		const content = `# ${title}

> [!INFO] ${title}
> ${desc}

---

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "${locale === "uk" ? "Сутність" : "Entity"}",
description AS "${locale === "uk" ? "Опис" : "Description"}",
dream_count AS "${locale === "uk" ? "Появ у снах" : "Dream Count"}",
last_seen AS "${locale === "uk" ? "Остання поява" : "Last Seen"}"
FROM "${categoryFolder}"
WHERE file.name != "${fileName.replace(/\.md$/, "")}"
SORT dream_count DESC
\`\`\`
`;

		const existing = app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			const currentContent = await app.vault.read(existing);
			if (currentContent !== content) {
				await app.vault.modify(existing, content);
			}
		} else {
			await app.vault.create(filePath, content);
		}
	}
}

export async function ensureDreamDashboard(app: App, settings: DreamAnalyzerSettings): Promise<void> {
	const rootFolder = (settings.dreamsFolder || "Dreams").trim().replace(/\/$/, "");
	const dreamsSubfolder = getDreamsSubfolder(app, settings);
	const entitiesFolder = getEntitiesSubfolder(app, settings);
	const locale = getLocale();

	await ensureFolder(app, rootFolder);
	await ensureFolder(app, dreamsSubfolder);
	await ensureFolder(app, entitiesFolder);

	await ensureEntityIndexes(app, settings);

	// Smart check: preserve existing Dashboard file (whether Дашборд снів.md or Dream Dashboard.md)
	let dashboardPath = `${rootFolder}/${t("dashboardFileName")}`;
	const ukPath = `${rootFolder}/Дашборд снів.md`;
	const enPath = `${rootFolder}/Dream Dashboard.md`;

	if (app.vault.getAbstractFileByPath(ukPath)) {
		dashboardPath = ukPath;
	} else if (app.vault.getAbstractFileByPath(enPath)) {
		dashboardPath = enPath;
	}

	const indexLinks = ENTITY_TYPES.map(tObj => {
		const idxName = locale === "uk" ? `Індекс - ${tObj.folder}` : `Index - ${tObj.folder}`;
		return `- [[${idxName}]]`;
	}).join("\n");

	const content = `${t("dashboardTitle")}

${t("dashboardCallout")}

---

## ${locale === "uk" ? "Індекси сутностей" : "Entity Category Indexes"}
${indexLinks}

---

${t("dashboardSectionStats")}

\`\`\`dataview
TABLE WITHOUT ID
  length(rows) AS "Всього снів",
  length(filter(rows, (r) => r.lucid = true)) AS "Усвідомлених (ОС)",
  round((length(filter(rows, (r) => r.lucid = true)) / length(rows)) * 100, 1) + "%" AS "% Усвідомленості"
FROM "${dreamsSubfolder}"
WHERE file.name != "${pathBasename(dashboardPath)}" AND file.name != "Дашборд снів" AND file.name != "Dream Dashboard"
GROUP BY true
\`\`\`

---

${t("dashboardSectionSigns")}

\`\`\`dataview
TABLE WITHOUT ID
  file.link AS "Маркер / Сутність",
  entity_type AS "Тип",
  dream_count AS "Появ у снах",
  last_seen AS "Остання поява"
FROM "${entitiesFolder}"
WHERE contains(["symbol", "character", "place"], entity_type)
SORT dream_count DESC
LIMIT 15
\`\`\`

---

${t("dashboardSectionEmotions")}

\`\`\`dataview
TABLE WITHOUT ID
  file.link AS "Емоція / Стан",
  dream_count AS "Згадок у снах",
  last_seen AS "Остання поява"
FROM "${entitiesFolder}"
WHERE entity_type = "emotion"
SORT dream_count DESC
LIMIT 10
\`\`\`

---

${t("dashboardSectionCreative")}

\`\`\`dataview
TABLE WITHOUT ID
  file.link AS "Концепт / Локація",
  entity_type AS "Категорія",
  description AS "Опис з аналізу",
  dream_count AS "Появ"
FROM "${entitiesFolder}"
WHERE contains(["concept", "place", "character"], entity_type) AND description != ""
SORT dream_count DESC
LIMIT 15
\`\`\`

---

${t("dashboardSectionLucid")}

\`\`\`dataview
TABLE WITHOUT ID
  file.link AS "Назва сну",
  date AS "Дата",
  length(characters) + length(places) + length(objects) AS "Сутностей у сні"
FROM "${dreamsSubfolder}"
WHERE lucid = true
SORT date DESC
LIMIT 20
\`\`\`

---

${t("dashboardSectionRecent")}

\`\`\`dataview
TABLE WITHOUT ID
  file.link AS "Запис сну",
  date AS "Дата",
  choice(lucid, "Усвідомлений (ОС)", "Звичайний") AS "Тип сну",
  length(keywords) AS "Ключових слів"
FROM "${dreamsSubfolder}"
WHERE file.name != "${pathBasename(dashboardPath)}" AND file.name != "Дашборд снів" AND file.name != "Dream Dashboard"
SORT file.name DESC
LIMIT 15
\`\`\`
`;

	const existing = app.vault.getAbstractFileByPath(dashboardPath);
	if (existing instanceof TFile) {
		const currentContent = await app.vault.read(existing);
		if (currentContent !== content) {
			await app.vault.modify(existing, content);
		}
	} else {
		await app.vault.create(dashboardPath, content);
	}
}

function pathBasename(pathStr: string): string {
	const idx = pathStr.lastIndexOf("/");
	const file = idx >= 0 ? pathStr.substring(idx + 1) : pathStr;
	return file.replace(/\.md$/, "");
}

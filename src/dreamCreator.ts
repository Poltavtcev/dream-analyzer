import { App, TFile, Notice, Modal, Setting, moment } from "obsidian";
import { DreamAnalyzerSettings, ENTITY_TYPES, DreamFrontmatter } from "./types";
import { t, tList, getLocale } from "./i18n";
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

		let selectedDate = moment().format("YYYY-MM-DD");

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
	const now = targetDateInput ? moment(targetDateInput, ["YYYY-MM-DD", "D.MM.YYYY", "DD.MM.YYYY"]) : moment();
	if (!now.isValid()) {
		new Notice("Некоректний формат дати");
		return;
	}

	const dateStr = now.format("YYYY-MM-DD");
	const dreamsFolder = getDreamsSubfolder(app, settings);
	await ensureFolder(app, dreamsFolder);

	const filePath = `${dreamsFolder}/${dateStr}.md`;

	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		new Notice(t("dreamAlreadyExists"));
		const leaf = app.workspace.getUnlinkableLeaf();
		await leaf.openFile(existingFile);
		return existingFile;
	}

	const days = tList("days");
	const months = tList("months");

	const dayOfWeek = days[now.day()] || "";
	const monthFormatted = months[now.month()] || "";

	const templateContent = `---
type: dream
date: ${dateStr}
tags:
  - dream
lucid: false
lucidity_level: 0
vividness: 3
sleep_quality: 3
dream_signs: []
emotions: []
characters: []
places: []
objects: []
symbols: []
concepts: []
keywords: []
entities_checked: false
---

# Сон від ${dateStr} (${dayOfWeek})

## 📝 Запис сновидіння

> Введіть сюди свій текст сну...

## 📊 Метадані та Оцінки

- **Тип сну**: 🟥 Звичайний / 🟩 Усвідомлений (ОС)
- **Рівень усвідомленості (0-5)**: 0
- **Яскравість (1-5)**: 3
- **Якість сну (1-5)**: 3
- **Маркери сну (Dream Signs)**: -

# AI аналіз

## Короткий опис

-

## Можливі зв'язки з попередніми снами

-
`;

	const newFile = await app.vault.create(filePath, templateContent);
	new Notice(t("dreamCreated"));

	const leaf = app.workspace.getUnlinkableLeaf();
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
round(length(filter(rows, (r) => r.lucid = true)) / length(rows) * 100, 1) + "%" AS "% ОС",
round(average(rows.vividness), 1) AS "Сер. яскравість",
round(average(rows.sleep_quality), 1) AS "Сер. якість сну"
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
date AS "Дата",
lucidity_level AS "Рівень ОС (1-5)",
vividness AS "Яскравість",
dream_signs AS "Маркери усвідомлення"
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
vividness AS "Яскравість",
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
tags:
  - dream
lucid: false
lucidity_level: 0
vividness: 3
sleep_quality: 3
dream_signs: []
emotions: []
characters: []
places: []
objects: []
symbols: []
concepts: []
keywords: []
entities_checked: false
---

# Сон від <% tp.file.title %> (<% tp.file.creation_date("dddd") %>)

## 📝 Запис сновидіння

> Введіть сюди свій текст сну...

## 📊 Метадані та Оцінки

- **Тип сну**: 🟥 Звичайний / 🟩 Усвідомлений (ОС)
- **Рівень усвідомленості (0-5)**: 0
- **Яскравість (1-5)**: 3
- **Якість сну (1-5)**: 3
- **Маркери сну (Dream Signs)**: -

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

import { App, TFile, Notice, moment } from "obsidian";
import {
	DreamAnalyzerSettings,
	DreamAnalysisResult,
	EntityItem,
	ENTITY_TYPES
} from "./types";
import { getOpenAiApiKey, requestChatCompletion, getEmbedding } from "./api";
import {
	getSimilarEntitiesContext,
	updateEntityEmbeddings,
	loadDreamEmbeddingsDatabase,
	saveDreamEmbeddingsDatabase,
	analyzeDreamConnections,
	formatDreamConnectionsMarkdown,
	getDreamsSubfolder,
	getEntitiesSubfolder
} from "./embeddings";

class ProgressNotice {
	private notice: Notice;
	private step: number;
	private totalSteps: number;
	private currentMessage: string;
	private startTime: number;
	private timerId: any;

	constructor(totalSteps: number = 5) {
		this.totalSteps = totalSteps;
		this.step = 1;
		this.currentMessage = "";
		this.startTime = Date.now();
		this.notice = new Notice("", 0);
		this.startTimer();
	}

	setStep(step: number, message: string) {
		this.step = step;
		this.currentMessage = message;
		this.updateText();
	}

	private startTimer() {
		this.timerId = setInterval(() => {
			this.updateText();
		}, 1000);
	}

	private updateText() {
		const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
		this.notice.setMessage(`[${this.step}/${this.totalSteps}] ${this.currentMessage} (${elapsedSec}s)`);
	}

	close() {
		if (this.timerId) clearInterval(this.timerId);
		this.notice.hide();
	}

	getElapsedSeconds(): number {
		return Math.floor((Date.now() - this.startTime) / 1000);
	}
}

export async function analyzeDream(app: App, file: TFile, settings: DreamAnalyzerSettings): Promise<void> {
	if (!file) {
		new Notice("Немає відкритої нотатки сну");
		return;
	}

	let apiKey: string;
	try {
		apiKey = await getOpenAiApiKey(app, settings);
	} catch (error: any) {
		new Notice(error.message || "Помилка OpenAI API Key");
		return;
	}

	const progress = new ProgressNotice(5);

	try {
		progress.setStep(1, "Генерація векторних даних сну...");
		const dreamContent = await app.vault.read(file);
		const dreamEmbedding = await getEmbedding(apiKey, settings.embeddingModel, dreamContent);

		progress.setStep(2, "Пошук схожих сутностей...");
		const similarEntities = await getSimilarEntitiesContext(app, apiKey, settings, dreamEmbedding);
		const entityContext = similarEntities || "Немає знайдених схожих сутностей.";

		progress.setStep(3, `Запит до OpenAI (${settings.openaiModel})...`);
		const systemPrompt = `
Ти аналізуєш особистий щоденник снів для створення структурованої бази знань Obsidian.
Ось список вже існуючих сутностей, які можуть відповідати цьому сну:

${entityContext}

Використовуй їх, якщо вони підходять.
Не створюй нову сутність, якщо вже існує така сама або дуже близька.

Поверни тільки JSON.
Формат:

{
"summary":"",
"characters":[],
"places":[],
"objects":[],
"emotions":[],
"symbols":[],
"concepts":[],
"keywords":[]
}

ВАЖЛИВО:
- Не використовуй [[ ]] у відповіді.
- Не створюй сутності, яких немає у тексті сну.
- Не додавай сутності лише для заповнення категорій.
- Якщо немає достатньо інформації — залишай масив порожнім.
- Одна й та сама сутність повинна мати стабільну назву у різних снах.

ФОРМАТ СУТНОСТЕЙ:

У масивах characters, places, objects, emotions, symbols, concepts повертай не рядки, а об'єкти:

{
"name":"",
"description":"",
"aliases":[]
}

name:
Коротка стабільна назва сутності.

description:
Короткий фактичний опис сутності саме у цьому сні.
Без психології і трактувань.

aliases:
Інші можливі назви. Якщо немає — [].

ПРАВИЛА НАЗВ СУТНОСТЕЙ:
- Назва повинна бути короткою.
- Назва повинна бути стабільною між різними снами.
- Назва повинна бути придатною для використання як назва файлу Obsidian.
- Використовуй одну найбільш загальну форму.
- Не додавай пояснення, описи або контекст ситуації.
- Не використовуй символи: / \\ : * ? " < > |

characters:
Включай тільки конкретних людей, істот або персонажів, які мають окрему роль у сні.

places:
Включай тільки самостійні локації, простори або географічні місця.

objects:
Включай тільки фізичні предмети, які існують у сні як окремі об'єкти.

emotions:
Включай тільки емоції, почуття або внутрішні психічні стани.

symbols:
Включай тільки потенційно повторювані образи, мотиви або символічні елементи.

concepts:
Включай тільки широкі абстрактні теми.

keywords:
Створи 5-15 ключових слів для пошуку. Окремі слова.

summary:
Створи короткий опис сну у 2-5 реченнях.
`;

		const rawResult = await requestChatCompletion(
			apiKey,
			settings.openaiModel,
			systemPrompt,
			dreamContent
		);

		const result: DreamAnalysisResult = {
			summary: rawResult.summary || "",
			characters: normalizeEntityArray(rawResult.characters),
			places: normalizeEntityArray(rawResult.places),
			objects: normalizeEntityArray(rawResult.objects),
			emotions: normalizeEntityArray(rawResult.emotions),
			symbols: normalizeEntityArray(rawResult.symbols),
			concepts: normalizeEntityArray(rawResult.concepts),
			keywords: normalizeStringArray(rawResult.keywords)
		};

		progress.setStep(4, "Створення сутностей та розрахунок зв'язків...");
		const modifiedEntityPaths = await createOrUpdateEntities(app, result, file, settings);

		const currentEntityNames = [
			...result.characters,
			...result.places,
			...result.objects,
			...result.symbols,
			...result.concepts
		].map(e => cleanEntityName(e.name)).filter(Boolean);

		const dreamDb = await loadDreamEmbeddingsDatabase(app, settings);
		const connections = analyzeDreamConnections(file, dreamEmbedding, currentEntityNames, dreamDb);
		const connectionsMarkdown = formatDreamConnectionsMarkdown(connections);

		// 1. Оновлюємо frontmatter файлу сну
		await app.fileManager.processFrontMatter(file, (fm) => {
			fm.type = "dream";
			fm.entities_checked = true;

			const toLinks = (arr: EntityItem[]) => arr.map(x => `[[${cleanEntityName(x.name)}]]`);
			fm.characters = toLinks(result.characters);
			fm.places = toLinks(result.places);
			fm.objects = toLinks(result.objects);
			fm.emotions = toLinks(result.emotions);
			fm.symbols = toLinks(result.symbols);
			fm.concepts = toLinks(result.concepts);
			fm.keywords = result.keywords.map(x => cleanEntityName(x));
		});

		// 2. У тілі нотатки сну залишаємо ТІЛЬКИ унікальну інформацію сну (Короткий опис та Зв'язки)
		const aiText = `
# AI аналіз

## Короткий опис

${result.summary || "-"}

## Можливі зв'язки з попередніми снами

${connectionsMarkdown}
`;

		let updatedContent = await app.vault.read(file);
		if (updatedContent.includes("# AI аналіз")) {
			updatedContent = updatedContent.replace(/# AI аналіз[\s\S]*/, aiText.trim());
		} else {
			updatedContent += `\n\n${aiText.trim()}`;
		}
		await app.vault.modify(file, updatedContent);

		// 3. Зберігаємо/оновлюємо вектор даного сну у dream_embeddings.json
		const createdDate = (moment as any)().format("YYYY-MM-DD");
		const cache = app.metadataCache.getFileCache(file);
		const dreamDate = (cache && cache.frontmatter && cache.frontmatter.date)
			? String(cache.frontmatter.date)
			: createdDate;

		const updatedDreamDb = dreamDb.filter(d => d.file !== file.path && d.name !== file.basename);
		updatedDreamDb.push({
			id: `dream_${file.basename}`,
			file: file.path,
			name: file.basename,
			date: dreamDate,
			entities: currentEntityNames,
			vector: dreamEmbedding
		});
		await saveDreamEmbeddingsDatabase(app, settings, updatedDreamDb);

		// 4. Пакетне оновлення ембедінгів сутностей у embeddings.json
		if (settings.autoUpdateEmbeddings && modifiedEntityPaths.length > 0) {
			progress.setStep(5, "Пакетне оновлення векторних ембедінгів...");
			await updateEntityEmbeddings(app, apiKey, settings, false, modifiedEntityPaths);
		}

		const totalSec = progress.getElapsedSeconds();
		progress.close();
		new Notice(`Сон успішно проаналізовано за ${totalSec}с!`);
	} catch (error: any) {
		progress.close();
		new Notice("Помилка аналізу сну: " + (error.message || error));
		console.error("Dream analysis failed:", error);
	}
}

function normalizeEntityArray(value: any): EntityItem[] {
	if (!Array.isArray(value)) return [];
	return value.map(item => {
		if (typeof item === "string") {
			const cleaned = cleanEntityName(item);
			return { name: cleaned, description: "", aliases: [] };
		} else if (typeof item === "object" && item !== null) {
			const cleaned = cleanEntityName(item.name);
			return {
				name: cleaned,
				description: String(item.description || ""),
				aliases: Array.isArray(item.aliases) ? item.aliases.map(a => cleanEntityName(a)).filter(Boolean) : []
			};
		}
		return { name: "", description: "", aliases: [] };
	}).filter(item => item.name.length > 0);
}

function normalizeStringArray(value: any): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(x => cleanEntityName(x)).filter(Boolean);
}

export function cleanEntityName(item: any): string {
	let name = typeof item === "object" && item !== null ? item.name : item;
	let str = String(name || "")
		.replace(/\[\[/g, "")
		.replace(/\]\]/g, "")
		.replace(/[\/\\:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!str) return "";
	return str.charAt(0).toUpperCase() + str.slice(1);
}

async function createOrUpdateEntities(
	app: App,
	result: DreamAnalysisResult,
	dreamFile: TFile,
	settings: DreamAnalyzerSettings
): Promise<string[]> {
	const dreamName = dreamFile.basename;
	const createdDate = (moment as any)().format("YYYY-MM-DD");

	const cache = app.metadataCache.getFileCache(dreamFile);
	const dreamDate = (cache && cache.frontmatter && cache.frontmatter.date)
		? String(cache.frontmatter.date)
		: createdDate;

	const baseFolder = getEntitiesSubfolder(app, settings);
	await ensureFolder(app, baseFolder);

	const modifiedPaths: string[] = [];

	for (const type of ENTITY_TYPES) {
		const folderPath = `${baseFolder}/${type.folder}`;
		await ensureFolder(app, folderPath);

		const items: EntityItem[] = (result as any)[type.field] || [];

		for (const item of items) {
			const safeName = cleanEntityName(item.name);
			if (!safeName) continue;

			const path = `${folderPath}/${safeName}.md`;
			const existingFile = app.vault.getAbstractFileByPath(path);

			if (existingFile instanceof TFile) {
				await app.fileManager.processFrontMatter(existingFile, (fm) => {
					fm.last_seen = dreamDate;
					fm.entity_type = type.entity_type;
					fm.embedding_status = "pending";

					const dreamLink = `[[${dreamName}]]`;
					if (!Array.isArray(fm.created_from)) {
						fm.created_from = fm.created_from ? [fm.created_from] : [];
					}
					if (!fm.created_from.includes(dreamLink)) {
						fm.created_from.push(dreamLink);
					}
					fm.dream_count = fm.created_from.length;

					if (item.aliases && item.aliases.length > 0) {
						if (!Array.isArray(fm.aliases)) fm.aliases = fm.aliases ? [fm.aliases] : [];
						for (const alias of item.aliases) {
							const cleanAlias = cleanEntityName(alias);
							if (cleanAlias && !fm.aliases.includes(cleanAlias)) {
								fm.aliases.push(cleanAlias);
							}
						}
					}
				});

				let entityText = await app.vault.read(existingFile);
				const updatedText = appendDreamAppearance(entityText, dreamName, item.description);
				if (entityText !== updatedText) {
					await app.vault.modify(existingFile, updatedText);
				}

				modifiedPaths.push(path);
			} else {
				const bodyContent = makeEntityBodyContent(
					app,
					safeName,
					item,
					dreamName,
					settings
				);
				const newFile = await app.vault.create(path, bodyContent);

				await app.fileManager.processFrontMatter(newFile, (fm) => {
					fm.type = "entity";
					fm.entity_type = type.entity_type;
					fm.created = createdDate;
					fm.last_seen = dreamDate;
					fm.created_from = [`[[${dreamName}]]`];
					fm.dream_count = 1;

					const cleanAliases = Array.isArray(item.aliases)
						? item.aliases.map(x => cleanEntityName(x)).filter(Boolean)
						: [];
					fm.aliases = cleanAliases;
					fm.tags = [type.entity_type];
					fm.description = item.description || "";
					fm.embedding_status = "pending";
					fm.embedding_id = "";
				});

				modifiedPaths.push(path);
			}
		}
	}

	return modifiedPaths;
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const normalizedPath = path.replace(/\/$/, "");
	if (!app.vault.getAbstractFileByPath(normalizedPath)) {
		await app.vault.createFolder(normalizedPath);
	}
}

function makeEntityBodyContent(
	app: App,
	name: string,
	item: EntityItem,
	dreamName: string,
	settings: DreamAnalyzerSettings
): string {
	const dreamsFolder = getDreamsSubfolder(app, settings);
	const entitiesFolder = getEntitiesSubfolder(app, settings);

	return `# ${name}

## Опис


## Появи у снах

- [[${dreamName}]]: ${makeInlineText(item.description || "поява у сні")}

## Статистика

\`\`\`dataview
TABLE WITHOUT ID
dream_count AS "Появ у снах",
last_seen AS "Остання поява"
FROM ""
WHERE file.path = this.file.path
\`\`\`

## Сни

\`\`\`dataview
LIST
FROM "${dreamsFolder}"
WHERE contains(characters, this.file.link)
   OR contains(places, this.file.link)
   OR contains(objects, this.file.link)
   OR contains(emotions, this.file.link)
   OR contains(symbols, this.file.link)
   OR contains(concepts, this.file.link)
SORT file.name DESC
LIMIT 20
\`\`\`

## Пов'язані сутності

\`\`\`dataview
TABLE WITHOUT ID
file.link AS "Сутність",
entity_type AS "Тип",
length(filter(created_from, (d) => contains(this.created_from, d))) AS "Спільних снів"
FROM "${entitiesFolder}"
WHERE length(filter(created_from, (d) => contains(this.created_from, d))) > 0
AND file.path != this.file.path
SORT length(filter(created_from, (d) => contains(this.created_from, d))) DESC
LIMIT 20
\`\`\`

## Нотатки

`;
}

function appendDreamAppearance(text: string, dreamName: string, description?: string): string {
	const line = `- [[${dreamName}]]: ${makeInlineText(description || "поява у сні")}`;
	const sectionPattern = /## Появи у снах\n([\s\S]*?)(?=\n## |$)/;
	const match = text.match(sectionPattern);

	if (!match) {
		return text.replace(
			/## Статистика/,
			`## Появи у снах\n\n${line}\n\n## Статистика`
		);
	}

	if (match[1].includes(`[[${dreamName}]]`)) {
		return text;
	}

	return text.replace(
		sectionPattern,
		`## Появи у снах\n${match[1].trim()}\n${line}\n`
	);
}

function makeInlineText(text: string): string {
	return String(text || "").replace(/\s+/g, " ").trim();
}

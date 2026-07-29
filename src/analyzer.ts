import { App, TFile, Notice, moment } from "obsidian";
import {
	DreamAnalyzerSettings,
	DreamAnalysisResult,
	EntityItem,
	ENTITY_TYPES,
	DreamFrontmatter
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

interface TypedMoment {
	format(fmt: string): string;
}

function getMoment(): TypedMoment {
	const fn = moment as unknown as () => TypedMoment;
	return fn();
}

const STOP_ENTITIES_LOWER = new Set([
	// Ukrainian
	"оповідач", "я", "сновидець", "моє тіло", "власне тіло", "себе", "автор", "моя особа", "самість",
	// English
	"narrator", "i", "me", "myself", "dreamer", "my body", "self", "own body"
]);

export function isStopEntity(name: string): boolean {
	if (!name) return true;
	const lower = name.trim().toLowerCase();
	return STOP_ENTITIES_LOWER.has(lower);
}

class ProgressNotice {
	private notice: Notice;
	private step: number;
	private totalSteps: number;
	private currentMessage: string;
	private startTime: number;
	private timerId: number | null = null;

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
		this.timerId = window.setInterval(() => {
			this.updateText();
		}, 1000);
	}

	private updateText() {
		const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
		this.notice.setMessage(`[${this.step}/${this.totalSteps}] ${this.currentMessage} (${elapsedSec}s)`);
	}

	close() {
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
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
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		new Notice(msg || "Помилка OpenAI API Key");
		return;
	}

	const progress = new ProgressNotice(5);

	try {
		progress.setStep(1, "Генерація векторних даних сну...");
		const dreamContent = await app.vault.read(file);
		const dreamEmbedding = await getEmbedding(apiKey, settings.embeddingModel, dreamContent);

		progress.setStep(2, "Пошук схожих сутностей...");
		const similarEntities = await getSimilarEntitiesContext(app, apiKey, settings, dreamEmbedding);
		const entityContext = similarEntities || "No existing similar entities found.";

		progress.setStep(3, `Запит до OpenAI (${settings.openaiModel})...`);
		const systemPrompt = `
You analyze a personal dream journal for creating a structured Obsidian knowledge base.
Here is a list of existing entities that might match this dream:

${entityContext}

Use existing entities if they fit. Do not create a new entity if an identical or very close entity already exists.

CRITICAL LANGUAGE REQUIREMENT:
- Automatically detect the language of the provided dream text (e.g., Ukrainian, English, etc.).
- ALL returned text fields ("summary", "name", "description", "aliases", "keywords") MUST be in the EXACT SAME LANGUAGE as the dream text.
- Do NOT translate the dream content, entity names, descriptions, or keywords into another language.

STOP ENTITIES & DEDUPLICATION RULES:
- Do NOT create trivial self-referential entities representing the dreamer or narrator (e.g., "Narrator", "Dreamer", "I", "Me", "My body", "Myself", "Оповідач", "Я", "Сновидець", "Моє тіло", "Власне тіло", "Себе").
- If the dreamer's identity, body transformation, or state of self is an important plot point, record this via appropriate "concepts" (e.g., "Body Transformation", "Identity Change", "Трансформація тіла", "Зміна особистості"), NOT via a "Narrator" character entity.
- Each entity must have a SINGLE unique name across all categories. Do NOT return duplicate entity names in different categories (e.g. if an item is an Object "Ladder", do NOT also create a Symbol "Ladder").

Return JSON ONLY.
Format:

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

CRITICAL FORMAT RULES:
- Do NOT use [[ ]] brackets in JSON values.
- Do NOT invent entities that are not present in the dream text.
- Do NOT add entities just to fill up categories.
- If there is not enough information for a category — keep the array empty.
- The same entity must maintain a stable name across different dreams.

ENTITY OBJECT FORMAT:
In characters, places, objects, emotions, symbols, concepts arrays, return objects:
{
"name":"",
"description":"",
"aliases":[]
}

name:
Short, stable entity name in the same language as the dream text.

description:
Short factual description of the entity in this specific dream. No psychology or subjective interpretations.

aliases:
Alternative names in the same language. Empty [] if none.

ENTITY NAMING RULES:
- Keep the name short and concise.
- Use one standard form across dreams.
- Ensure names are suitable as Obsidian note titles.
- Do NOT include symbols: / \\ : * ? " < > |

CATEGORIES:
characters: Specific people, creatures, or characters with a role in the dream (EXCLUDING the dreamer/narrator).
places: Independent locations, spaces, or geographic places.
objects: Physical items that exist in the dream as distinct objects.
emotions: Feelings, emotions, or internal mental states.
symbols: Potentially recurring motifs, symbols, or imagery.
concepts: Broad abstract themes, plot events, or transformations.
keywords: 5-15 search keywords in the dream's language.

summary:
A short summary of the dream in 2-5 sentences in the dream's language.
`;

		const rawResult = await requestChatCompletion(
			apiKey,
			settings.openaiModel,
			systemPrompt,
			dreamContent
		);

		const result: DreamAnalysisResult = {
			summary: typeof rawResult.summary === "string" ? rawResult.summary : "",
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
		const connections = analyzeDreamConnections(app, file, dreamEmbedding, currentEntityNames, dreamDb);
		const connectionsMarkdown = formatDreamConnectionsMarkdown(connections);

		// 1. Оновлюємо frontmatter файлу сну
		await app.fileManager.processFrontMatter(file, (fm: DreamFrontmatter) => {
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
		const createdDate = getMoment().format("YYYY-MM-DD");
		const cache = app.metadataCache.getFileCache(file);
		const frontmatterObj: Record<string, unknown> | undefined = cache?.frontmatter;
		const dreamDate = typeof frontmatterObj?.date === "string" ? frontmatterObj.date : createdDate;

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
	} catch (error: unknown) {
		progress.close();
		const msg = error instanceof Error ? error.message : String(error);
		new Notice("Помилка аналізу сну: " + msg);
	}
}

function normalizeEntityArray(value: unknown): EntityItem[] {
	if (!Array.isArray(value)) return [];
	return value.map(item => {
		if (typeof item === "string") {
			const cleaned = cleanEntityName(item);
			return { name: cleaned, description: "", aliases: [] };
		} else if (typeof item === "object" && item !== null) {
			const obj = item as Record<string, unknown>;
			const cleaned = cleanEntityName(obj.name);
			const aliases = Array.isArray(obj.aliases)
				? obj.aliases.map(a => cleanEntityName(a)).filter(Boolean)
				: [];
			return {
				name: cleaned,
				description: typeof obj.description === "string" ? obj.description : "",
				aliases
			};
		}
		return { name: "", description: "", aliases: [] };
	})
	.filter(item => item.name.length > 0 && !isStopEntity(item.name));
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(x => cleanEntityName(x)).filter(x => x.length > 0 && !isStopEntity(x));
}

export function cleanEntityName(item: unknown): string {
	let name = typeof item === "object" && item !== null ? (item as { name?: unknown }).name : item;
	let str = String(name || "")
		.replace(/\[\[/g, "")
		.replace(/\]\]/g, "")
		.replace(/[/\\:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!str) return "";
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function findExistingEntityFile(app: App, baseFolder: string, safeName: string): TFile | null {
	for (const type of ENTITY_TYPES) {
		const categoryFolderPath = `${baseFolder}/${type.folder}`;
		const candidatePath = `${categoryFolderPath}/${safeName}.md`;
		const file = app.vault.getAbstractFileByPath(candidatePath);
		if (file instanceof TFile) {
			return file;
		}
	}
	return null;
}

async function createOrUpdateEntities(
	app: App,
	result: DreamAnalysisResult,
	dreamFile: TFile,
	settings: DreamAnalyzerSettings
): Promise<string[]> {
	const dreamName = dreamFile.basename;
	const createdDate = getMoment().format("YYYY-MM-DD");

	const cache = app.metadataCache.getFileCache(dreamFile);
	const frontmatterObj: Record<string, unknown> | undefined = cache?.frontmatter;
	const dreamDate = typeof frontmatterObj?.date === "string" ? frontmatterObj.date : createdDate;

	const baseFolder = getEntitiesSubfolder(app, settings);
	await ensureFolder(app, baseFolder);

	const modifiedPaths: string[] = [];

	for (const type of ENTITY_TYPES) {
		const folderPath = `${baseFolder}/${type.folder}`;
		await ensureFolder(app, folderPath);

		const items: EntityItem[] = type.field === "characters" ? result.characters
			: type.field === "places" ? result.places
			: type.field === "objects" ? result.objects
			: type.field === "emotions" ? result.emotions
			: type.field === "symbols" ? result.symbols
			: result.concepts;

		for (const item of items) {
			const safeName = cleanEntityName(item.name);
			if (!safeName || isStopEntity(safeName)) continue;

			// Check if entity note with this name ALREADY EXISTS anywhere in baseFolder
			const existingFile = findExistingEntityFile(app, baseFolder, safeName);

			if (existingFile instanceof TFile) {
				await app.fileManager.processFrontMatter(existingFile, (fm: DreamFrontmatter) => {
					fm.last_seen = dreamDate;
					fm.embedding_status = "pending";

					const dreamLink = `[[${dreamName}]]`;
					if (!Array.isArray(fm.created_from)) {
						fm.created_from = fm.created_from ? [String(fm.created_from)] : [];
					}
					if (!fm.created_from.includes(dreamLink)) {
						fm.created_from.push(dreamLink);
					}
					fm.dream_count = fm.created_from.length;

					if (item.aliases && item.aliases.length > 0) {
						if (!Array.isArray(fm.aliases)) fm.aliases = fm.aliases ? [String(fm.aliases)] : [];
						for (const alias of item.aliases) {
							const cleanAlias = cleanEntityName(alias);
							if (cleanAlias && !isStopEntity(cleanAlias) && !fm.aliases.includes(cleanAlias)) {
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

				modifiedPaths.push(existingFile.path);
			} else {
				const path = `${folderPath}/${safeName}.md`;
				const bodyContent = makeEntityBodyContent(
					app,
					safeName,
					item,
					dreamName,
					settings
				);
				const newFile = await app.vault.create(path, bodyContent);
				const newEmbeddingId = `emb_${Date.now()}_${safeName.toLowerCase()}`;

				await app.fileManager.processFrontMatter(newFile, (fm: DreamFrontmatter) => {
					fm.type = "entity";
					fm.entity_type = type.entity_type;
					fm.created = createdDate;
					fm.last_seen = dreamDate;
					fm.created_from = [`[[${dreamName}]]`];
					fm.dream_count = 1;

					const cleanAliases = Array.isArray(item.aliases)
						? item.aliases.map(x => cleanEntityName(x)).filter(x => x.length > 0 && !isStopEntity(x))
						: [];
					fm.aliases = cleanAliases;
					fm.tags = [type.entity_type];
					fm.description = item.description || "";
					fm.embedding_status = "pending";
					fm.embedding_id = newEmbeddingId;
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
	const entitiesSubfolder = getEntitiesSubfolder(app, settings);

	return `# ${name.toLowerCase()}

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
FROM "${entitiesSubfolder}"
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

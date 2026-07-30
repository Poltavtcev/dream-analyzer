import { App, TFile, Notice, moment, normalizePath } from "obsidian";
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
	syncUnindexedDreams,
	saveDreamEmbeddingsDatabase,
	analyzeDreamConnections,
	formatDreamConnectionsMarkdown,
	getDreamsSubfolder,
	getEntitiesSubfolder
} from "./embeddings";
import { getLocale, t } from "./i18n";

interface TypedMoment {
	format(fmt: string): string;
}

function getMoment(): TypedMoment {
	const fn = moment as unknown as () => TypedMoment;
	return fn();
}

const STOP_ENTITIES_LOWER = new Set([
	// Ukrainian & Russian
	"оповідач", "я", "сновидець", "моє тіло", "власне тіло", "себе", "автор", "моя особа", "самість", "рассказчик", "мое тело",
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

	getElapsedSeconds(): number {
		return Math.round((Date.now() - this.startTime) / 1000);
	}

	private startTimer() {
		this.timerId = window.setInterval(() => {
			this.updateText();
		}, 1000);
	}

	private updateText() {
		const elapsed = this.getElapsedSeconds();
		const message = `Dream Analyzer [${this.step}/${this.totalSteps}]: ${this.currentMessage} (${elapsed}s)`;

		const noticeEl = (this.notice as unknown as { noticeEl: HTMLElement }).noticeEl;
		if (noticeEl) {
			noticeEl.setText(message);
		}
	}

	close() {
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
		this.notice.hide();
	}
}

export function extractDreamTextOnly(fullFileContent: string): string {
	// Strip YAML frontmatter if present
	let body = fullFileContent;
	if (body.startsWith("---")) {
		const endIdx = body.indexOf("---", 3);
		if (endIdx !== -1) {
			body = body.slice(endIdx + 3);
		}
	}

	// Cut off previous AI analysis section in Ukrainian or English
	const aiSectionIdxUk = body.indexOf("# AI аналіз");
	if (aiSectionIdxUk !== -1) {
		body = body.slice(0, aiSectionIdxUk);
	}
	const aiSectionIdxEn = body.indexOf("# AI Analysis");
	if (aiSectionIdxEn !== -1) {
		body = body.slice(0, aiSectionIdxEn);
	}

	// Remove standard headers like "# Сон" or "# Dream"
	body = body.replace(/^#\s*Сон\s*$/gm, "");
	body = body.replace(/^#\s*Dream\s*$/gm, "");

	// Clean up placeholder text if user forgot to remove it
	body = body.replace(/>\s*Введіть сюди свій текст сну\.\.\./gi, "");
	body = body.replace(/>\s*Enter your dream text here\.\.\./gi, "");

	// Strip blockquote markers '>' so OpenAI receives clean prose
	body = body.replace(/^>\s?/gm, "");

	return body.trim();
}

export async function analyzeDream(app: App, file: TFile, settings: DreamAnalyzerSettings): Promise<void> {
	if (!file) {
		new Notice(t("noDreamNoteOpen"));
		return;
	}

	let apiKey: string;
	try {
		apiKey = await getOpenAiApiKey(app, settings);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		new Notice(msg || "OpenAI API Key Error");
		return;
	}

	const fullContent = await app.vault.read(file);
	const userDreamText = extractDreamTextOnly(fullContent);

	if (!userDreamText || userDreamText.length < 10) {
		new Notice(t("dreamTextTooShort"));
		return;
	}

	const progress = new ProgressNotice(5);

	try {
		progress.setStep(1, t("step1VectorGen"));
		const dreamEmbedding = await getEmbedding(apiKey, settings.embeddingModel, userDreamText);

		progress.setStep(2, t("step2SearchEntities"));
		const similarEntities = await getSimilarEntitiesContext(app, apiKey, settings, dreamEmbedding);
		const entityContext = similarEntities || "No existing similar entities found.";

		progress.setStep(3, t("step3OpenAiReq", { model: settings.openaiModel }));
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
			userDreamText
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

		progress.setStep(4, t("step4CreateEntities"));
		const modifiedEntityPaths = await createOrUpdateEntities(app, result, file, settings);

		const currentEntityNames = [
			...result.characters,
			...result.places,
			...result.objects,
			...result.symbols,
			...result.concepts
		].map(e => cleanEntityName(e.name)).filter(Boolean);

		const connections = await analyzeDreamConnections(app, apiKey, settings, file, dreamEmbedding, currentEntityNames);
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
		const lang = getLocale();
		const aiSectionHeader = lang === "uk" ? "# AI аналіз" : "# AI Analysis";
		const summarySectionHeader = lang === "uk" ? "## Короткий опис" : "## Summary";
		const connectionsSectionHeader = lang === "uk" ? "## Можливі зв'язки з попередніми снами" : "## Possible Connections";

		const aiText = `
${aiSectionHeader}

${summarySectionHeader}

${result.summary || "-"}

${connectionsSectionHeader}

${connectionsMarkdown}
`;

		let updatedContent = await app.vault.read(file);
		if (updatedContent.includes("# AI аналіз")) {
			updatedContent = updatedContent.replace(/# AI аналіз[\s\S]*/, aiText.trim());
		} else if (updatedContent.includes("# AI Analysis")) {
			updatedContent = updatedContent.replace(/# AI Analysis[\s\S]*/, aiText.trim());
		} else {
			updatedContent += `\n\n${aiText.trim()}`;
		}
		await app.vault.modify(file, updatedContent);

		// 3. Зберігаємо/оновлюємо вектор даного сну у dream_embeddings.json
		const createdDate = getMoment().format("YYYY-MM-DD");
		const cache = app.metadataCache.getFileCache(file);
		const frontmatterObj: Record<string, unknown> | undefined = cache?.frontmatter;
		const dreamDate = typeof frontmatterObj?.date === "string" ? frontmatterObj.date : createdDate;

		const dreamDb = await syncUnindexedDreams(app, apiKey, settings);
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
			progress.setStep(5, t("step5BatchUpdate"));
			await updateEntityEmbeddings(app, apiKey, settings, false);
		}

		const totalSec = progress.getElapsedSeconds();
		progress.close();
		new Notice(t("dreamAnalyzedSuccess", { sec: totalSec }));
	} catch (error: unknown) {
		progress.close();
		const msg = error instanceof Error ? error.message : String(error);
		new Notice("Error: " + msg);
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
			const rawName = typeof obj.name === "string" ? obj.name : "";
			const cleaned = cleanEntityName(rawName);
			const description = typeof obj.description === "string" ? obj.description.trim() : "";
			const aliases = Array.isArray(obj.aliases)
				? obj.aliases.map(a => cleanEntityName(String(a))).filter(Boolean)
				: [];
			return { name: cleaned, description, aliases };
		}
		return { name: "", description: "", aliases: [] };
	}).filter(item => Boolean(item.name) && !isStopEntity(item.name));
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(item => cleanEntityName(String(item)))
		.filter(item => Boolean(item) && !isStopEntity(item));
}

function cleanEntityName(name: string): string {
	if (!name) return "";
	return name
		.replace(/^\[\[/, "")
		.replace(/\]\]$/, "")
		.replace(/[\\/:*?"<>|]/g, "")
		.trim();
}

async function createOrUpdateEntities(
	app: App,
	result: DreamAnalysisResult,
	dreamFile: TFile,
	settings: DreamAnalyzerSettings
): Promise<string[]> {
	const modifiedPaths: string[] = [];
	const baseEntitiesFolder = getEntitiesSubfolder(app, settings);
	const lang = getLocale();

	const enFolderNames: Record<string, string> = {
		"Персонажі": "Characters",
		"Місця": "Places",
		"Предмети": "Objects",
		"Емоції": "Emotions",
		"Символи": "Symbols",
		"Концепти": "Concepts"
	};

	for (const typeInfo of ENTITY_TYPES) {
		const items = result[typeInfo.field];
		if (!items || items.length === 0) continue;

		let folderSubName = typeInfo.folder;
		if (lang === "en") {
			const altName = enFolderNames[typeInfo.folder] || typeInfo.folder;
			if (app.vault.getAbstractFileByPath(`${baseEntitiesFolder}/${typeInfo.folder}`)) {
				folderSubName = typeInfo.folder;
			} else {
				folderSubName = altName;
			}
		}

		const targetFolder = `${baseEntitiesFolder}/${folderSubName}`;
		await ensureFolder(app, targetFolder);

		const descHeader = lang === "uk" ? "## Опис та сюжетний контекст" : "## Description & Story Context";
		const relHeader = lang === "uk" ? "## Пов'язані сни" : "## Related Dreams";
		const emptyDesc = lang === "uk" ? "Опис буде додано після нових снів." : "Description will be updated after new dreams.";
		const dateCol = lang === "uk" ? "Дата" : "Date";
		const typeCol = lang === "uk" ? "Тип" : "Type";
		const lucidOpt = lang === "uk" ? "ОС" : "Lucid";
		const regOpt = lang === "uk" ? "Ззвичайний" : "Regular";

		for (const item of items) {
			if (isStopEntity(item.name)) continue;

			const filePath = `${targetFolder}/${item.name}.md`;
			const existingFile = app.vault.getAbstractFileByPath(filePath);

			if (existingFile instanceof TFile) {
				await app.fileManager.processFrontMatter(existingFile, (fm: DreamFrontmatter) => {
					fm.type = "entity";
					fm.entity_type = typeInfo.entity_type;
					fm.last_seen = getMoment().format("YYYY-MM-DD");

					const dreamsList = Array.isArray(fm.created_from) ? fm.created_from.map(String) : [];
					const dreamLink = `[[${dreamFile.basename}]]`;
					if (!dreamsList.includes(dreamLink)) {
						dreamsList.push(dreamLink);
					}
					fm.created_from = dreamsList;
					fm.dream_count = dreamsList.length;

					if (item.aliases.length > 0) {
						const currentAliases = Array.isArray(fm.aliases) ? fm.aliases.map(String) : [];
						for (const alias of item.aliases) {
							if (!currentAliases.includes(alias)) {
								currentAliases.push(alias);
							}
						}
						fm.aliases = currentAliases;
					}

					if (item.description && !fm.description) {
						fm.description = item.description;
					}
				});
				modifiedPaths.push(existingFile.path);
			} else {
				const frontmatter = `---
type: entity
entity_type: ${typeInfo.entity_type}
created: ${getMoment().format("YYYY-MM-DD")}
last_seen: ${getMoment().format("YYYY-MM-DD")}
created_from:
  - "[[${dreamFile.basename}]]"
dream_count: 1
aliases: ${JSON.stringify(item.aliases)}
description: ${JSON.stringify(item.description)}
embedding_status: pending
---

# ${item.name}

${descHeader}

${item.description || emptyDesc}

${relHeader}

\`\`\`dataview
TABLE date AS "${dateCol}", choice(lucid, "${lucidOpt}", "${regOpt}") AS "${typeCol}"
FROM "${getDreamsSubfolder(app, settings)}"
WHERE type = "dream" AND contains(file.outlinks, [[${item.name}]])
SORT date DESC
\`\`\`
`;
				const newFile = await app.vault.create(filePath, frontmatter);
				modifiedPaths.push(newFile.path);
			}
		}
	}

	return modifiedPaths;
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const normalizedPath = normalizePath(path);
	if (!app.vault.getAbstractFileByPath(normalizedPath)) {
		await app.vault.createFolder(normalizedPath);
	}
}

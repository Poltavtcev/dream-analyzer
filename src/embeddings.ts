import { App, TFile, normalizePath } from "obsidian";
import {
	DreamAnalyzerSettings,
	VectorDatabaseItem,
	DreamVectorDatabaseItem,
	SimilarEntity,
	DreamConnectionResult
} from "./types";
import { getBatchEmbeddings } from "./api";
import { getLocale } from "./i18n";

let cachedEntityDb: { dbPath: string; data: VectorDatabaseItem[] } | null = null;
let cachedDreamDb: { dbPath: string; data: DreamVectorDatabaseItem[] } | null = null;

export function clearMemoryCache(): void {
	cachedEntityDb = null;
	cachedDreamDb = null;
}

export function getDreamsSubfolder(app: App, settings: DreamAnalyzerSettings): string {
	const base = normalizePath(settings.dreamsFolder.trim() || "Dreams");
	const lang = getLocale();
	const subname = lang === "uk" ? "Сни" : "Dreams";
	return normalizePath(`${base}/${subname}`);
}

export function getEntitiesSubfolder(app: App, settings: DreamAnalyzerSettings): string {
	const base = normalizePath(settings.dreamsFolder.trim() || "Dreams");
	const lang = getLocale();
	const subname = lang === "uk" ? "Сутності" : "Entities";
	return normalizePath(`${base}/${subname}`);
}

export function getEmbeddingsPath(app: App, settings: DreamAnalyzerSettings): string {
	const base = normalizePath(settings.dreamsFolder.trim() || "Dreams");
	return normalizePath(`${base}/embeddings.json`);
}

export function getDreamEmbeddingsPath(app: App, settings: DreamAnalyzerSettings): string {
	const base = normalizePath(settings.dreamsFolder.trim() || "Dreams");
	return normalizePath(`${base}/dream_embeddings.json`);
}

export async function loadEmbeddingsDatabase(app: App, settings: DreamAnalyzerSettings): Promise<VectorDatabaseItem[]> {
	const dbPath = getEmbeddingsPath(app, settings);
	if (cachedEntityDb && cachedEntityDb.dbPath === dbPath) {
		return cachedEntityDb.data;
	}
	try {
		const file = app.vault.getAbstractFileByPath(dbPath);
		if (file instanceof TFile) {
			const content = await app.vault.read(file);
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				cachedEntityDb = { dbPath, data: parsed };
				return parsed;
			}
		}
	} catch {
		// Silent catch for missing or invalid database file
	}
	cachedEntityDb = { dbPath, data: [] };
	return [];
}

export async function saveEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	data: VectorDatabaseItem[]
): Promise<void> {
	const dbPath = getEmbeddingsPath(app, settings);
	cachedEntityDb = { dbPath, data };
	const jsonContent = JSON.stringify(data, null, 2);
	const file = app.vault.getAbstractFileByPath(dbPath);
	if (file instanceof TFile) {
		await app.vault.modify(file, jsonContent);
	} else {
		await app.vault.create(dbPath, jsonContent);
	}
}

export async function loadDreamEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings
): Promise<DreamVectorDatabaseItem[]> {
	const dbPath = getDreamEmbeddingsPath(app, settings);
	if (cachedDreamDb && cachedDreamDb.dbPath === dbPath) {
		return cachedDreamDb.data;
	}
	try {
		const file = app.vault.getAbstractFileByPath(dbPath);
		if (file instanceof TFile) {
			const content = await app.vault.read(file);
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				cachedDreamDb = { dbPath, data: parsed };
				return parsed;
			}
		}
	} catch {
		// Silent catch for missing or invalid dream database file
	}
	cachedDreamDb = { dbPath, data: [] };
	return [];
}

export async function saveDreamEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	data: DreamVectorDatabaseItem[]
): Promise<void> {
	const dbPath = getDreamEmbeddingsPath(app, settings);
	cachedDreamDb = { dbPath, data };
	const jsonContent = JSON.stringify(data, null, 2);
	const file = app.vault.getAbstractFileByPath(dbPath);
	if (file instanceof TFile) {
		await app.vault.modify(file, jsonContent);
	} else {
		await app.vault.create(dbPath, jsonContent);
	}
}

export async function handleFileRename(
	app: App,
	file: TFile,
	oldPath: string,
	settings: DreamAnalyzerSettings
): Promise<void> {
	try {
		const entityDb = await loadEmbeddingsDatabase(app, settings);
		let entityChanged = false;
		for (const item of entityDb) {
			if (item.file === oldPath) {
				item.file = file.path;
				item.name = file.basename;
				entityChanged = true;
			}
		}
		if (entityChanged) {
			await saveEmbeddingsDatabase(app, settings, entityDb);
		}

		const dreamDb = await loadDreamEmbeddingsDatabase(app, settings);
		let dreamChanged = false;
		for (const item of dreamDb) {
			if (item.file === oldPath) {
				item.file = file.path;
				item.name = file.basename;
				dreamChanged = true;
			}
		}
		if (dreamChanged) {
			await saveDreamEmbeddingsDatabase(app, settings, dreamDb);
		}
	} catch {
		// Silent catch for rename handling
	}
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
	if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
		return 0;
	}
	let dotProduct = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < vecA.length; i++) {
		dotProduct += vecA[i] * vecB[i];
		normA += vecA[i] * vecA[i];
		normB += vecB[i] * vecB[i];
	}
	if (normA === 0 || normB === 0) return 0;
	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function searchSimilarEntities(
	targetVector: number[],
	database: VectorDatabaseItem[],
	threshold: number = 0.35,
	limit: number = 40
): SimilarEntity[] {
	if (!targetVector || database.length === 0) return [];
	const results: SimilarEntity[] = [];
	for (const item of database) {
		if (!item.vector || item.vector.length === 0) continue;
		const sim = cosineSimilarity(targetVector, item.vector);
		if (sim >= threshold) {
			results.push({ item, similarity: sim });
		}
	}
	results.sort((a, b) => b.similarity - a.similarity);
	return results.slice(0, limit);
}

export async function getSimilarEntitiesContext(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	dreamEmbedding: number[]
): Promise<string> {
	const db = await loadEmbeddingsDatabase(app, settings);
	if (db.length === 0) return "";
	const matches = searchSimilarEntities(
		dreamEmbedding,
		db,
		settings.similarityThreshold,
		settings.similarityLimit
	);
	if (matches.length === 0) return "";
	const lines = matches.map(m => {
		const aliasesText = m.item.aliases && m.item.aliases.length > 0 ? ` (aliases: ${m.item.aliases.join(", ")})` : "";
		return `- ${m.item.name} [Type: ${m.item.type}]${aliasesText}: ${m.item.description || "No description"}`;
	});
	return lines.join("\n");
}

export async function updateEntityEmbeddings(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	forceRebuildAll: boolean = false,
	specificFilePaths?: string[]
): Promise<number> {
	const entitiesFolder = getEntitiesSubfolder(app, settings);
	const db = forceRebuildAll ? [] : await loadEmbeddingsDatabase(app, settings);
	const dbMap = new Map<string, VectorDatabaseItem>();
	for (const item of db) {
		dbMap.set(item.file, item);
	}

	const allFiles = app.vault.getMarkdownFiles();
	const entityFiles = allFiles.filter(f => f.path.startsWith(entitiesFolder));

	const targetFiles = specificFilePaths && specificFilePaths.length > 0
		? entityFiles.filter(f => specificFilePaths.includes(f.path))
		: entityFiles;

	const toProcess: { file: TFile; textToEmbed: string; name: string; type: string; aliases: string[]; description: string }[] = [];

	for (const file of targetFiles) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || fm.type !== "entity") continue;

		const entityName = file.basename;
		const entityType = fm.entity_type || "concept";
		const aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
		const description = fm.description || "";

		const textToEmbed = `${entityName}. ${description}. Aliases: ${aliases.join(", ")}`;

		const existing = dbMap.get(file.path);
		if (!forceRebuildAll && existing && existing.textHash === simpleHash(textToEmbed)) {
			continue;
		}

		toProcess.push({
			file,
			textToEmbed,
			name: entityName,
			type: entityType,
			aliases,
			description
		});
	}

	if (toProcess.length === 0) return 0;

	const BATCH_SIZE = 20;
	let processedCount = 0;

	for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
		const batch = toProcess.slice(i, i + BATCH_SIZE);
		const inputs = batch.map(b => b.textToEmbed);
		const embeddings = await getBatchEmbeddings(apiKey, settings.embeddingModel, inputs);

		for (let j = 0; j < batch.length; j++) {
			const item = batch[j];
			const vec = embeddings[j];
			if (!vec) continue;

			const hash = simpleHash(item.textToEmbed);
			const dbItem: VectorDatabaseItem = {
				id: `entity_${item.file.basename}`,
				file: item.file.path,
				name: item.name,
				type: item.type,
				aliases: item.aliases,
				description: item.description,
				vector: vec,
				textHash: hash
			};

			dbMap.set(item.file.path, dbItem);

			await app.fileManager.processFrontMatter(item.file, (fm) => {
				fm.embedding_status = "active";
				fm.embedding_id = dbItem.id;
			});

			processedCount++;
		}
	}

	const updatedDb = Array.from(dbMap.values());
	await saveEmbeddingsDatabase(app, settings, updatedDb);
	return processedCount;
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash.toString(36);
}

export function analyzeDreamConnections(
	currentDreamFile: TFile,
	currentVector: number[],
	currentEntities: string[],
	dreamDatabase: DreamVectorDatabaseItem[],
	limit: number = 5
): DreamConnectionResult[] {
	if (dreamDatabase.length === 0) return [];
	const results: DreamConnectionResult[] = [];
	const curEntitySet = new Set(currentEntities.map(e => e.toLowerCase()));

	for (const dream of dreamDatabase) {
		if (dream.file === currentDreamFile.path || dream.name === currentDreamFile.basename) {
			continue;
		}

		let vectorSim = 0;
		if (currentVector && dream.vector && dream.vector.length > 0) {
			vectorSim = cosineSimilarity(currentVector, dream.vector);
		}

		const otherEntities = (dream.entities || []).map(e => e.toLowerCase());
		const sharedEntities: string[] = [];
		for (const entity of otherEntities) {
			if (curEntitySet.has(entity)) {
				sharedEntities.push(entity);
			}
		}

		const entitySim = (dream.entities || []).length > 0
			? sharedEntities.length / Math.max(curEntitySet.size, dream.entities.length)
			: 0;

		const combinedScore = (vectorSim * 0.5) + (entitySim * 0.5);

		if (combinedScore > 0.15 || sharedEntities.length > 0) {
			results.push({
				dreamFile: dream.file,
				dreamName: dream.name,
				date: dream.date || "",
				vectorSimilarity: vectorSim,
				sharedEntities: sharedEntities.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
				score: combinedScore
			});
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, limit);
}

export function formatDreamConnectionsMarkdown(connections: DreamConnectionResult[]): string {
	if (connections.length === 0) {
		return "_Поки що не знайдено схожих попередніх снів._";
	}
	const lines = connections.map(conn => {
		const percent = Math.round(conn.score * 100);
		const sharedText = conn.sharedEntities.length > 0
			? ` (спільні сутності: ${conn.sharedEntities.map(e => `[[${e}]]`).join(", ")})`
			: "";
		const dateText = conn.date ? ` [${conn.date}]` : "";
		return `- [[${conn.dreamName}]]${dateText} — схожість ${percent}%${sharedText}`;
	});
	return lines.join("\n");
}

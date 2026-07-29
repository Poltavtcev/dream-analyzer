import { App, TFile, normalizePath } from "obsidian";
import {
	DreamAnalyzerSettings,
	VectorDatabaseItem,
	DreamVectorDatabaseItem,
	DreamConnectionResult,
	ENTITY_TYPES
} from "./types";

const VECTOR_DB_FILENAME = "entity_embeddings.json";
const DREAM_VECTOR_DB_FILENAME = "dream_embeddings.json";

let memoryEntityDb: VectorDatabaseItem[] | null = null;
let memoryDreamDb: DreamVectorDatabaseItem[] | null = null;

export function clearMemoryCache(): void {
	memoryEntityDb = null;
	memoryDreamDb = null;
}

export function getDreamsSubfolder(app: App, settings?: Partial<DreamAnalyzerSettings>): string {
	const rawFolder = (settings && typeof settings.dreamsFolder === "string") ? settings.dreamsFolder : "Dreams";
	const dreamsBase = rawFolder.trim().replace(/\/$/, "") || "Dreams";
	return `${dreamsBase}/Сни`;
}

export function getEntitiesSubfolder(app: App, settings?: Partial<DreamAnalyzerSettings>): string {
	const rawFolder = (settings && typeof settings.dreamsFolder === "string") ? settings.dreamsFolder : "Dreams";
	const dreamsBase = rawFolder.trim().replace(/\/$/, "") || "Dreams";
	return `${dreamsBase}/Сутності`;
}

function getDreamsBase(settings?: Partial<DreamAnalyzerSettings>): string {
	const rawFolder = (settings && typeof settings.dreamsFolder === "string") ? settings.dreamsFolder : "Dreams";
	return rawFolder.trim().replace(/\/$/, "") || "Dreams";
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const normalizedPath = normalizePath(path);
	if (!app.vault.getAbstractFileByPath(normalizedPath)) {
		await app.vault.createFolder(normalizedPath);
	}
}

export async function loadEntityEmbeddingsDatabase(app: App, settings: DreamAnalyzerSettings): Promise<VectorDatabaseItem[]> {
	if (memoryEntityDb !== null) return memoryEntityDb;
	const dreamsBase = getDreamsBase(settings);
	const dbPath = `${dreamsBase}/${VECTOR_DB_FILENAME}`;

	const file = app.vault.getAbstractFileByPath(dbPath);
	if (file instanceof TFile) {
		try {
			const content = await app.vault.read(file);
			const parsed = JSON.parse(content) as VectorDatabaseItem[];
			if (Array.isArray(parsed)) {
				memoryEntityDb = parsed.filter(item => {
					if (!item.file) return false;
					return !!app.vault.getAbstractFileByPath(item.file);
				});
				return memoryEntityDb;
			}
		} catch {
			// Memory DB fallback
		}
	}
	memoryEntityDb = [];
	return memoryEntityDb;
}

export async function saveEntityEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	items: VectorDatabaseItem[]
): Promise<void> {
	const dreamsBase = getDreamsBase(settings);
	await ensureFolder(app, dreamsBase);
	const dbPath = `${dreamsBase}/${VECTOR_DB_FILENAME}`;

	const validItems = items.filter(item => {
		if (!item.file) return false;
		return !!app.vault.getAbstractFileByPath(item.file);
	});

	memoryEntityDb = validItems;

	const content = JSON.stringify(validItems, null, 2);
	const file = app.vault.getAbstractFileByPath(dbPath);

	if (file instanceof TFile) {
		await app.vault.modify(file, content);
	} else {
		await app.vault.create(dbPath, content);
	}
}

export const saveEmbeddingsDatabase = saveEntityEmbeddingsDatabase;

export async function loadDreamEmbeddingsDatabase(app: App, settings: DreamAnalyzerSettings): Promise<DreamVectorDatabaseItem[]> {
	if (memoryDreamDb !== null) return memoryDreamDb;
	const dreamsBase = getDreamsBase(settings);
	const dbPath = `${dreamsBase}/${DREAM_VECTOR_DB_FILENAME}`;

	const file = app.vault.getAbstractFileByPath(dbPath);
	if (file instanceof TFile) {
		try {
			const content = await app.vault.read(file);
			const parsed = JSON.parse(content) as DreamVectorDatabaseItem[];
			if (Array.isArray(parsed)) {
				memoryDreamDb = parsed.filter(item => {
					if (!item.file) return false;
					return !!app.vault.getAbstractFileByPath(item.file);
				});
				return memoryDreamDb;
			}
		} catch {
			// Memory DB fallback
		}
	}
	memoryDreamDb = [];
	return memoryDreamDb;
}

export async function saveDreamEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	items: DreamVectorDatabaseItem[]
): Promise<void> {
	const dreamsBase = getDreamsBase(settings);
	await ensureFolder(app, dreamsBase);
	const dbPath = `${dreamsBase}/${DREAM_VECTOR_DB_FILENAME}`;

	const validItems = items.filter(item => {
		if (!item.file) return false;
		return !!app.vault.getAbstractFileByPath(item.file);
	});

	memoryDreamDb = validItems;

	const content = JSON.stringify(validItems, null, 2);
	const file = app.vault.getAbstractFileByPath(dbPath);

	if (file instanceof TFile) {
		await app.vault.modify(file, content);
	} else {
		await app.vault.create(dbPath, content);
	}
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
	if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < vecA.length; i++) {
		dot += vecA[i] * vecB[i];
		normA += vecA[i] * vecA[i];
		normB += vecB[i] * vecB[i];
	}

	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeSimpleHash(text: string): string {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash.toString(36);
}

export async function updateEntityEmbeddings(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	forceAll: boolean = false
): Promise<number> {
	if (!apiKey) return 0;

	const db = await loadEntityEmbeddingsDatabase(app, settings);
	const dbMap = new Map<string, VectorDatabaseItem>();

	for (const item of db) {
		if (item.file && app.vault.getAbstractFileByPath(item.file)) {
			dbMap.set(item.file, item);
		}
	}

	const baseEntitiesFolder = getEntitiesSubfolder(app, settings);
	const allFiles = app.vault.getMarkdownFiles();
	const entityFiles = allFiles.filter(f => f.path.startsWith(baseEntitiesFolder) && !f.name.startsWith("!"));

	const getEmbeddingFn = (await import("./api")).getEmbedding;

	let updatedCount = 0;
	const updatedItems: VectorDatabaseItem[] = [];

	for (const file of entityFiles) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter || {};

		if (fm.type !== "entity") continue;

		const name = file.basename;
		const entityType = (fm.entity_type as string) || "concept";
		const aliases = Array.isArray(fm.aliases) ? fm.aliases.map(a => String(a)) : [];
		const description = (fm.description as string) || "";

		const textToHash = `${name}|${entityType}|${aliases.join(",")}|${description}`;
		const currentHash = computeSimpleHash(textToHash);

		const existing = dbMap.get(file.path);

		if (!forceAll && existing && existing.textHash === currentHash && existing.vector && existing.vector.length > 0) {
			updatedItems.push(existing);
			continue;
		}

		try {
			const textToEmbed = `Сутність: ${name}. Тип: ${entityType}. Опис: ${description}. Синоніми: ${aliases.join(", ")}`;
			const vector = await getEmbeddingFn(apiKey, (settings && settings.embeddingModel) || "text-embedding-3-small", textToEmbed);

			const timestamp = Date.now().toString(36);
			const safeName = name.toLowerCase().replace(/[^a-z0-9а-яєіїґ]/gi, "_");
			const embeddingId = existing?.id || `emb_${timestamp}_${safeName}`;

			const newItem: VectorDatabaseItem = {
				id: embeddingId,
				file: file.path,
				name,
				type: entityType,
				aliases,
				description,
				vector,
				textHash: currentHash
			};

			updatedItems.push(newItem);
			updatedCount++;

			await app.fileManager.processFrontMatter(file, (matter: Record<string, unknown>) => {
				matter["embedding_status"] = "done";
				matter["embedding_id"] = embeddingId;
			});
		} catch {
			if (existing) {
				updatedItems.push(existing);
			}
		}
	}

	await saveEntityEmbeddingsDatabase(app, settings, updatedItems);
	return updatedCount;
}

export async function getSimilarEntitiesContext(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	dreamEmbedding: number[]
): Promise<string> {
	if (!dreamEmbedding || dreamEmbedding.length === 0) return "";

	const db = await loadEntityEmbeddingsDatabase(app, settings);
	if (db.length === 0) return "";

	const threshold = (settings && typeof settings.similarityThreshold === "number") ? settings.similarityThreshold : 0.35;
	const limit = (settings && typeof settings.similarityLimit === "number") ? settings.similarityLimit : 40;

	const scored: { item: VectorDatabaseItem; similarity: number }[] = [];

	for (const item of db) {
		if (!item.vector || item.vector.length === 0) continue;
		const sim = cosineSimilarity(dreamEmbedding, item.vector);
		if (sim >= threshold) {
			scored.push({ item, similarity: sim });
		}
	}

	scored.sort((a, b) => b.similarity - a.similarity);
	const topItems = scored.slice(0, limit);

	if (topItems.length === 0) return "";

	const formatted = topItems.map(s => {
		const it = s.item;
		const aliasStr = it.aliases && it.aliases.length > 0 ? ` (синоніми: ${it.aliases.join(", ")})` : "";
		const descStr = it.description ? ` - ${it.description}` : "";
		return `- [${it.type}] ${it.name}${aliasStr}${descStr}`;
	});

	return formatted.join("\n");
}

export async function syncUnindexedDreams(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings
): Promise<DreamVectorDatabaseItem[]> {
	const dreamsDb = await loadDreamEmbeddingsDatabase(app, settings);
	const dbMap = new Map<string, DreamVectorDatabaseItem>();

	for (const item of dreamsDb) {
		if (item.file && app.vault.getAbstractFileByPath(item.file)) {
			dbMap.set(item.file, item);
		}
	}

	const dreamsFolder = getDreamsSubfolder(app, settings);
	const allFiles = app.vault.getMarkdownFiles();
	const dreamFiles = allFiles.filter(f => f.path.startsWith(dreamsFolder) && f.extension === "md");

	const getEmbeddingFn = (await import("./api")).getEmbedding;
	let isDbChanged = false;
	const updatedItems: DreamVectorDatabaseItem[] = [];

	for (const file of dreamFiles) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = (cache?.frontmatter || {}) as Record<string, unknown>;
		if (fm.type !== "dream") continue;

		const existing = dbMap.get(file.path);
		if (existing && existing.vector && existing.vector.length > 0) {
			updatedItems.push(existing);
			continue;
		}

		if (!apiKey) continue;

		try {
			const dreamContent = await app.vault.read(file);
			const vector = await getEmbeddingFn(apiKey, (settings && settings.embeddingModel) || "text-embedding-3-small", dreamContent);
			const dateStr = (fm.date as string) || file.basename;

			const allEntities: string[] = [];
			for (const t of ENTITY_TYPES) {
				const list = fm[t.field];
				if (Array.isArray(list)) {
					for (const e of list as unknown[]) {
						const cleanName = String(e).replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
						if (cleanName) allEntities.push(cleanName);
					}
				}
			}

			const newItem: DreamVectorDatabaseItem = {
				id: `dream_emb_${Date.now().toString(36)}_${file.basename}`,
				file: file.path,
				name: file.basename,
				date: dateStr,
				entities: Array.from(new Set(allEntities)),
				vector
			};

			updatedItems.push(newItem);
			isDbChanged = true;
		} catch {
			if (existing) {
				updatedItems.push(existing);
			}
		}
	}

	if (isDbChanged) {
		await saveDreamEmbeddingsDatabase(app, settings, updatedItems);
	}

	return updatedItems;
}

export async function analyzeDreamConnections(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	currentDreamFile: TFile,
	currentDreamEmbedding: number[],
	currentEntities: string[]
): Promise<DreamConnectionResult[]> {
	await syncUnindexedDreams(app, apiKey, settings);
	const dreamsDb = await loadDreamEmbeddingsDatabase(app, settings);
	if (dreamsDb.length === 0) return [];

	const threshold = (settings && typeof settings.similarityThreshold === "number") ? settings.similarityThreshold : 0.35;

	const currentEntitiesSet = new Set(
		(currentEntities || []).map(e => e.replace(/^\[\[/, "").replace(/\]\]$/, "").trim().toLowerCase()).filter(Boolean)
	);

	const results: DreamConnectionResult[] = [];

	for (const dream of dreamsDb) {
		if (dream.file === currentDreamFile.path) continue;

		const targetFile = app.vault.getAbstractFileByPath(dream.file);
		if (!targetFile) continue;

		const vecSim = cosineSimilarity(currentDreamEmbedding, dream.vector);

		const dreamEntities = dream.entities || [];
		const shared: string[] = [];

		for (const entityName of dreamEntities) {
			const cleanName = entityName.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
			if (cleanName && currentEntitiesSet.has(cleanName.toLowerCase())) {
				shared.push(cleanName);
			}
		}

		const uniqueShared = Array.from(new Set(shared));
		const sharedCount = uniqueShared.length;
		const entitySim = Math.min(1.0, sharedCount / Math.max(1, currentEntitiesSet.size));

		const combinedScore = (vecSim * 0.5) + (entitySim * 0.5);

		if (combinedScore >= threshold) {
			results.push({
				dreamFile: dream.file,
				dreamName: dream.name,
				date: dream.date,
				vectorSimilarity: vecSim,
				sharedEntities: uniqueShared,
				score: combinedScore
			});
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, 10);
}

export function formatDreamConnectionsMarkdown(connections: DreamConnectionResult[]): string {
	if (connections.length === 0) {
		return "_Поки що не знайдено схожих попередніх снів._";
	}
	const lines = connections.map(conn => {
		const percent = Math.round(conn.score * 100);
		const uniqueEntities = Array.from(new Set(conn.sharedEntities.filter(Boolean)));
		const sharedText = uniqueEntities.length > 0
			? ` (спільні сутності: ${uniqueEntities.map(e => `[[${e}]]`).join(", ")})`
			: "";

		const hasDateInName = conn.date && conn.dreamName.includes(conn.date);
		const dateText = (conn.date && !hasDateInName) ? ` (${conn.date})` : "";

		return `- [[${conn.dreamName}]]${dateText} — схожість ${percent}%${sharedText}`;
	});
	return lines.join("\n");
}

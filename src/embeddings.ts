import { App, TFile, Notice } from "obsidian";
import {
	DreamAnalyzerSettings,
	VectorDatabaseItem,
	DreamVectorDatabaseItem,
	SimilarEntity,
	DreamConnectionResult
} from "./types";
import { getEmbedding, getBatchEmbeddings } from "./api";
import { getLocale } from "./i18n";

let cachedEntityDb: { dbPath: string; data: VectorDatabaseItem[] } | null = null;
let cachedDreamDb: { dbPath: string; data: DreamVectorDatabaseItem[] } | null = null;

export function clearMemoryCache(): void {
	cachedEntityDb = null;
	cachedDreamDb = null;
}

export function getDreamsSubfolder(app: App, settings: DreamAnalyzerSettings): string {
	const root = (settings?.dreamsFolder || "Dreams").trim().replace(/\/$/, "");
	// Smart check: if 'Сни' or 'Dreams' folder already exists in root, preserve existing structure
	if (app && app.vault) {
		if (app.vault.getAbstractFileByPath(`${root}/Сни`)) return `${root}/Сни`;
		if (app.vault.getAbstractFileByPath(`${root}/Dreams`)) return `${root}/Dreams`;
	}
	const locale = getLocale();
	const sub = locale === "uk" ? "Сни" : "Dreams";
	return `${root}/${sub}`;
}

export function getEntitiesSubfolder(app: App, settings: DreamAnalyzerSettings): string {
	const root = (settings?.dreamsFolder || "Dreams").trim().replace(/\/$/, "");
	// Smart check: if 'Сутності' or 'Entities' folder already exists in root, preserve existing structure
	if (app && app.vault) {
		if (app.vault.getAbstractFileByPath(`${root}/Сутності`)) return `${root}/Сутності`;
		if (app.vault.getAbstractFileByPath(`${root}/Entities`)) return `${root}/Entities`;
	}
	const locale = getLocale();
	const sub = locale === "uk" ? "Сутності" : "Entities";
	return `${root}/${sub}`;
}

export function getEntityEmbeddingsDbPath(app: App, settings: DreamAnalyzerSettings): string {
	const folder = getDreamsSubfolder(app, settings);
	return `${folder}/embeddings.json`;
}

export function getDreamEmbeddingsDbPath(app: App, settings: DreamAnalyzerSettings): string {
	const folder = getDreamsSubfolder(app, settings);
	return `${folder}/dream_embeddings.json`;
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
		return null;
	}

	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	if (normA === 0 || normB === 0) {
		return null;
	}

	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function ensureParentDirectory(app: App, filePath: string): Promise<void> {
	const normalizedPath = filePath.trim();
	const dirIndex = normalizedPath.lastIndexOf("/");
	if (dirIndex > 0) {
		const dir = normalizedPath.substring(0, dirIndex);
		if (!(await app.vault.adapter.exists(dir))) {
			await app.vault.createFolder(dir);
		}
	}
}

export async function loadEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	forceReload: boolean = false
): Promise<VectorDatabaseItem[]> {
	const dbPath = getEntityEmbeddingsDbPath(app, settings);

	if (!forceReload && cachedEntityDb && cachedEntityDb.dbPath === dbPath) {
		return cachedEntityDb.data;
	}

	try {
		const exists = await app.vault.adapter.exists(dbPath);
		if (!exists) {
			await saveEmbeddingsDatabase(app, settings, []);
			return [];
		}
		const content = await app.vault.adapter.read(dbPath);
		const rawData = JSON.parse(content);
		const data: VectorDatabaseItem[] = Array.isArray(rawData) ? rawData : [];

		// Purge orphan vector entries (where entity note file no longer exists)
		const cleanData = data.filter(item => item && item.file && app.vault.getAbstractFileByPath(item.file));

		cachedEntityDb = { dbPath, data: cleanData };

		if (cleanData.length !== data.length) {
			await saveEmbeddingsDatabase(app, settings, cleanData);
		}

		return cleanData;
	} catch (e) {
		console.warn("Could not load embeddings database:", e);
		return [];
	}
}

export async function saveEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	database: VectorDatabaseItem[]
): Promise<void> {
	const dbPath = getEntityEmbeddingsDbPath(app, settings);
	await ensureParentDirectory(app, dbPath);
	await app.vault.adapter.write(dbPath, JSON.stringify(database, null, 2));
	cachedEntityDb = { dbPath, data: database };
}

export async function loadDreamEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	forceReload: boolean = false
): Promise<DreamVectorDatabaseItem[]> {
	const dbPath = getDreamEmbeddingsDbPath(app, settings);

	if (!forceReload && cachedDreamDb && cachedDreamDb.dbPath === dbPath) {
		return cachedDreamDb.data;
	}

	try {
		const exists = await app.vault.adapter.exists(dbPath);
		if (!exists) {
			await saveDreamEmbeddingsDatabase(app, settings, []);
			return [];
		}
		const content = await app.vault.adapter.read(dbPath);
		const rawData = JSON.parse(content);
		const data: DreamVectorDatabaseItem[] = Array.isArray(rawData) ? rawData : [];

		// Purge orphan vector entries (where dream note file no longer exists)
		const cleanData = data.filter(item => item && item.file && app.vault.getAbstractFileByPath(item.file));

		cachedDreamDb = { dbPath, data: cleanData };

		if (cleanData.length !== data.length) {
			await saveDreamEmbeddingsDatabase(app, settings, cleanData);
		}

		return cleanData;
	} catch (e) {
		console.warn("Could not load dream embeddings database:", e);
		return [];
	}
}

export async function saveDreamEmbeddingsDatabase(
	app: App,
	settings: DreamAnalyzerSettings,
	database: DreamVectorDatabaseItem[]
): Promise<void> {
	const dbPath = getDreamEmbeddingsDbPath(app, settings);
	await ensureParentDirectory(app, dbPath);
	await app.vault.adapter.write(dbPath, JSON.stringify(database, null, 2));
	cachedDreamDb = { dbPath, data: database };
}

export async function handleFileRename(
	app: App,
	settings: DreamAnalyzerSettings,
	file: TFile,
	oldPath: string
): Promise<void> {
	if (!(file instanceof TFile) || file.extension !== "md") return;

	const entitiesFolder = getEntitiesSubfolder(app, settings);
	const dreamsFolder = getDreamsSubfolder(app, settings);

	let updated = false;

	if (oldPath.startsWith(entitiesFolder) || file.path.startsWith(entitiesFolder)) {
		let entityDb = await loadEmbeddingsDatabase(app, settings);
		let itemChanged = false;

		entityDb = entityDb.map(item => {
			if (item.file === oldPath) {
				itemChanged = true;
				return {
					...item,
					file: file.path,
					name: file.basename
				};
			}
			return item;
		});

		if (itemChanged) {
			await saveEmbeddingsDatabase(app, settings, entityDb);
			updated = true;
		}
	}

	if (oldPath.startsWith(dreamsFolder) || file.path.startsWith(dreamsFolder)) {
		let dreamDb = await loadDreamEmbeddingsDatabase(app, settings);
		let itemChanged = false;

		dreamDb = dreamDb.map(item => {
			if (item.file === oldPath) {
				itemChanged = true;
				return {
					...item,
					file: file.path,
					name: file.basename
				};
			}
			return item;
		});

		if (itemChanged) {
			await saveDreamEmbeddingsDatabase(app, settings, dreamDb);
			updated = true;
		}
	}

	if (updated) {
		console.log(`[Dream Analyzer] Updated vector embedding path from ${oldPath} to ${file.path}`);
	}
}

export function selectSimilarEntities(
	dreamVector: number[],
	database: VectorDatabaseItem[],
	threshold: number = 0.35,
	limit: number = 40
): SimilarEntity[] {
	if (!Array.isArray(dreamVector) || dreamVector.length === 0 || !Array.isArray(database)) {
		return [];
	}

	const results: SimilarEntity[] = [];

	for (const item of database) {
		if (!item || !item.name || !Array.isArray(item.vector)) continue;
		const score = cosineSimilarity(dreamVector, item.vector);
		if (score !== null && score >= threshold) {
			results.push({
				name: item.name,
				type: item.type || "",
				description: item.description || "",
				aliases: Array.isArray(item.aliases) ? item.aliases : [],
				file: item.file || "",
				score
			});
		}
	}

	return results
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

export function formatEntityContext(entities: SimilarEntity[]): string {
	if (!Array.isArray(entities) || entities.length === 0) return "";

	return entities.map(item => {
		const aliases = item.aliases && item.aliases.length ? item.aliases.join(", ") : "-";
		return [
			`- ${item.name} (${item.type})`,
			`  Схожість: ${item.score.toFixed(3)}`,
			`  Опис: ${item.description || "-"}`,
			`  Аліаси: ${aliases}`
		].join("\n");
	}).join("\n\n");
}

export async function getSimilarEntitiesContext(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	dreamVector: number[]
): Promise<string> {
	try {
		const database = await loadEmbeddingsDatabase(app, settings);
		const matches = selectSimilarEntities(
			dreamVector,
			database,
			settings.similarityThreshold,
			settings.similarityLimit
		);
		return formatEntityContext(matches);
	} catch (error) {
		console.warn("Could not get similar entities for context:", error);
		return "";
	}
}

export function analyzeDreamConnections(
	currentFile: TFile,
	currentEmbedding: number[],
	currentEntities: string[],
	dreamDatabase: DreamVectorDatabaseItem[]
): DreamConnectionResult[] {
	if (!Array.isArray(currentEmbedding) || currentEmbedding.length === 0 || !Array.isArray(dreamDatabase)) {
		return [];
	}

	const currentSet = new Set(currentEntities.map(e => e.toLowerCase()));
	const results: DreamConnectionResult[] = [];

	for (const dream of dreamDatabase) {
		if (dream.file === currentFile.path || dream.name === currentFile.basename) {
			continue;
		}

		const embSim = cosineSimilarity(currentEmbedding, dream.vector) || 0;
		const validEmbSim = Math.max(embSim, 0);

		const dreamEntities = Array.isArray(dream.entities) ? dream.entities : [];
		const commonEntities: string[] = [];
		const seenCommon = new Set<string>();

		for (const entity of dreamEntities) {
			const lower = entity.toLowerCase();
			if (currentSet.has(lower) && !seenCommon.has(lower)) {
				seenCommon.add(lower);
				commonEntities.push(entity);
			}
		}

		const entityScore = currentEntities.length > 0
			? commonEntities.length / Math.max(currentEntities.length, 1)
			: 0;

		const finalScore = 0.5 * validEmbSim + 0.5 * Math.min(entityScore, 1.0);
		const scorePercent = Math.round(finalScore * 100);

		if (scorePercent >= 15 && (validEmbSim >= 0.20 || commonEntities.length > 0)) {
			results.push({
				dreamName: dream.name,
				dreamPath: dream.file,
				scorePercent,
				embeddingSimilarity: validEmbSim,
				entityScore,
				commonEntities
			});
		}
	}

	return results
		.sort((a, b) => b.scorePercent - a.scorePercent)
		.slice(0, 5);
}

export function formatDreamConnectionsMarkdown(connections: DreamConnectionResult[]): string {
	if (!Array.isArray(connections) || connections.length === 0) {
		return "-";
	}

	return connections.map(conn => {
		let item = `- **[[${conn.dreamName}]]** — **${conn.scorePercent}%** схожості`;
		if (conn.commonEntities && conn.commonEntities.length > 0) {
			item += `\n  - Спільні сутності:`;
			for (const entity of conn.commonEntities) {
				item += `\n    - [[${entity}]]`;
			}
		}
		return item;
	}).join("\n\n");
}

export async function updateEntityEmbeddings(
	app: App,
	apiKey: string,
	settings: DreamAnalyzerSettings,
	forceRebuild: boolean = false,
	specificPaths?: string[]
): Promise<number> {
	const entitiesFolder = getEntitiesSubfolder(app, settings);
	const allFiles = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(entitiesFolder));
	let database = await loadEmbeddingsDatabase(app, settings, forceRebuild);

	const targets: { file: TFile; text: string; embeddingId: string; fm: any }[] = [];

	for (const file of allFiles) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter || {};

		const isTargeted = specificPaths ? specificPaths.includes(file.path) : false;
		if (fm.embedding_status === "done" && !forceRebuild && !isTargeted) {
			continue;
		}

		const embeddingId = `emb_${Date.now()}_${file.basename}`;
		const text = `
Назва:
${file.basename}

Тип:
${fm.entity_type || ""}

Опис:
${fm.description || ""}

Аліаси:
${Array.isArray(fm.aliases) ? fm.aliases.join(", ") : ""}

Теги:
${Array.isArray(fm.tags) ? fm.tags.join(", ") : ""}
`;
		targets.push({ file, text, embeddingId, fm });
	}

	if (targets.length === 0) return 0;

	// Single batch API call for all targets
	const inputs = targets.map(t => t.text);
	const vectors = await getBatchEmbeddings(apiKey, settings.embeddingModel, inputs);

	let updatedCount = 0;
	for (let i = 0; i < targets.length; i++) {
		const target = targets[i];
		const vector = vectors[i];
		if (!vector) continue;

		database = database.filter(item => item.file !== target.file.path);
		database.push({
			id: target.embeddingId,
			file: target.file.path,
			name: target.file.basename,
			type: target.fm.entity_type || "",
			description: target.fm.description || "",
			aliases: Array.isArray(target.fm.aliases) ? target.fm.aliases : [],
			vector: vector
		});

		await app.fileManager.processFrontMatter(target.file, (frontmatter) => {
			frontmatter.embedding_status = "done";
			frontmatter.embedding_id = target.embeddingId;
		});

		updatedCount++;
	}

	if (updatedCount > 0 || forceRebuild) {
		await saveEmbeddingsDatabase(app, settings, database);
	}

	return updatedCount;
}

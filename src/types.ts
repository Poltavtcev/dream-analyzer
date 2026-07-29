export type EntityCategory = "characters" | "places" | "objects" | "emotions" | "symbols" | "concepts";

export interface EntityItem {
	name: string;
	description: string;
	aliases: string[];
}

export interface DreamAnalysisResult {
	summary: string;
	characters: EntityItem[];
	places: EntityItem[];
	objects: EntityItem[];
	emotions: EntityItem[];
	symbols: EntityItem[];
	concepts: EntityItem[];
	keywords: string[];
}

export interface VectorDatabaseItem {
	id: string;
	file: string;
	name: string;
	type: string;
	aliases: string[];
	description: string;
	vector: number[];
	textHash: string;
}

export interface DreamVectorDatabaseItem {
	id: string;
	file: string;
	name: string;
	date: string;
	entities: string[];
	vector: number[];
}

export interface SimilarEntity {
	item: VectorDatabaseItem;
	similarity: number;
}

export interface DreamConnectionResult {
	dreamFile: string;
	dreamName: string;
	date: string;
	vectorSimilarity: number;
	sharedEntities: string[];
	score: number;
}

export interface DreamAnalyzerSettings {
	openaiApiKey: string;
	openaiModel: string;
	embeddingModel: string;
	dreamsFolder: string;
	templateFilePath: string;
	similarityThreshold: number;
	similarityLimit: number;
	autoUpdateEmbeddings: boolean;
}

export const DEFAULT_SETTINGS: DreamAnalyzerSettings = {
	openaiApiKey: "",
	openaiModel: "gpt-5-mini",
	embeddingModel: "text-embedding-3-small",
	dreamsFolder: "Dreams",
	templateFilePath: "Templates/Dream Template.md",
	similarityThreshold: 0.35,
	similarityLimit: 40,
	autoUpdateEmbeddings: true
};

export const ENTITY_TYPES: { field: EntityCategory; folder: string; entity_type: string }[] = [
	{ field: "characters", folder: "Персонажі", entity_type: "character" },
	{ field: "places", folder: "Місця", entity_type: "place" },
	{ field: "objects", folder: "Предмети", entity_type: "object" },
	{ field: "emotions", folder: "Емоції", entity_type: "emotion" },
	{ field: "symbols", folder: "Символи", entity_type: "symbol" },
	{ field: "concepts", folder: "Концепти", entity_type: "concept" }
];

export interface DreamFrontmatter {
	type?: string;
	entity_type?: string;
	date?: string;
	created?: string;
	last_seen?: string;
	created_from?: string[];
	dream_count?: number;
	lucid?: boolean;
	entities_checked?: boolean;
	characters?: string[];
	places?: string[];
	objects?: string[];
	emotions?: string[];
	symbols?: string[];
	concepts?: string[];
	keywords?: string[];
	aliases?: string[];
	tags?: string[];
	description?: string;
	embedding_status?: string;
	embedding_id?: string;
}

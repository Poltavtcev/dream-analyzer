import { App, requestUrl } from "obsidian";
import { DreamAnalyzerSettings } from "./types";

interface OpenAiEmbeddingItem {
	index: number;
	embedding: number[];
}

interface OpenAiEmbeddingResponse {
	data?: OpenAiEmbeddingItem[];
	error?: { message?: string; code?: string };
}

interface OpenAiChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: { message?: string; code?: string };
}

export async function getOpenAiApiKey(app: App, settings: DreamAnalyzerSettings): Promise<string> {
	let key = (settings.openaiApiKey || "").trim();

	if (!key) {
		throw new Error("OpenAI API Key не вказано! Вкажіть його у налаштуваннях плагіна.");
	}

	// 1. If key is already a direct OpenAI API Key starting with sk-, return directly
	if (key.startsWith("sk-")) {
		return key;
	}

	// 2. Try resolving key from Obsidian SecretStorage if key is a secret name
	const appObj = app as unknown as Record<string, unknown>;
	const secretStorage = appObj["secretStorage"] as { getSecret?: (k: string) => Promise<string | undefined> } | undefined;
	if (secretStorage && typeof secretStorage.getSecret === "function") {
		try {
			const resolvedSecret = await secretStorage.getSecret(key);
			if (resolvedSecret && resolvedSecret.trim()) {
				return resolvedSecret.trim();
			}
		} catch {
			// SecretStorage fallback
		}
	}

	// 3. Fallback: return raw key string
	return key;
}

async function openAiRequest(
	url: string,
	apiKey: string,
	bodyObj: Record<string, unknown>
): Promise<{ status: number; text: string; json: unknown }> {
	const bodyString = JSON.stringify(bodyObj);
	const headers = {
		"Authorization": `Bearer ${apiKey}`,
		"Content-Type": "application/json"
	};

	// 1. Try native window.fetch first for uninhibited response body reading
	if (typeof window !== "undefined" && typeof window.fetch === "function") {
		try {
			const res = await window.fetch(url, {
				method: "POST",
				headers,
				body: bodyString
			});

			const text = await res.text();
			let parsedJson: unknown = null;
			try {
				parsedJson = JSON.parse(text) as unknown;
			} catch {
				// Ignore parse error
			}

			return { status: res.status, text, json: parsedJson };
		} catch {
			// Fallback to requestUrl on fetch error
		}
	}

	// 2. Fallback to Obsidian requestUrl
	const res = await requestUrl({
		url,
		method: "POST",
		headers,
		body: bodyString,
		throwOnError: false
	});

	return { status: res.status, text: res.text, json: res.json as unknown };
}

export async function getEmbedding(apiKey: string, model: string, text: string): Promise<number[]> {
	const res = await openAiRequest("https://api.openai.com/v1/embeddings", apiKey, {
		input: text,
		model: model || "text-embedding-3-small"
	});

	if (res.status >= 400) {
		const json = res.json as OpenAiEmbeddingResponse | null;
		const msg = json?.error?.message || res.text || `HTTP ${res.status}`;
		throw new Error(`OpenAI Embedding Error (${res.status}): ${msg}`);
	}

	const json = res.json as OpenAiEmbeddingResponse | null;
	if (json && json.data && json.data.length > 0 && json.data[0].embedding) {
		return json.data[0].embedding;
	}

	throw new Error("Не вдалося отримати embedding від OpenAI");
}

export async function getBatchEmbeddings(apiKey: string, model: string, texts: string[]): Promise<number[][]> {
	if (!texts || texts.length === 0) return [];

	const res = await openAiRequest("https://api.openai.com/v1/embeddings", apiKey, {
		input: texts,
		model: model || "text-embedding-3-small"
	});

	if (res.status >= 400) {
		const json = res.json as OpenAiEmbeddingResponse | null;
		const msg = json?.error?.message || res.text || `HTTP ${res.status}`;
		throw new Error(`OpenAI Batch Embedding Error (${res.status}): ${msg}`);
	}

	const json = res.json as OpenAiEmbeddingResponse | null;
	if (json && json.data && Array.isArray(json.data)) {
		const sorted = [...json.data].sort((a, b) => a.index - b.index);
		return sorted.map(item => item.embedding);
	}

	throw new Error("Не вдалося отримати batch embeddings від OpenAI");
}

export async function requestChatCompletion(
	apiKey: string,
	model: string,
	systemPrompt: string,
	userPrompt: string
): Promise<Record<string, unknown>> {
	const targetModel = (model || "gpt-5-mini").trim();

	const reqBody: Record<string, unknown> = {
		model: targetModel,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt }
		],
		response_format: { type: "json_object" }
	};

	// Only attach custom temperature if not gpt-5 or reasoning model
	if (targetModel.startsWith("gpt-4")) {
		reqBody.temperature = 0.2;
	}

	const res = await openAiRequest("https://api.openai.com/v1/chat/completions", apiKey, reqBody);

	if (res.status >= 400) {
		const json = res.json as OpenAiChatResponse | null;
		const msg = json?.error?.message || res.text || `HTTP ${res.status}`;
		const code = json?.error?.code ? ` (code: ${json.error.code})` : "";
		throw new Error(`OpenAI Chat Completion Error (${res.status}): ${msg}${code}`);
	}

	const json = res.json as OpenAiChatResponse | null;
	if (json && json.choices && json.choices.length > 0 && json.choices[0].message?.content) {
		const rawContent = json.choices[0].message.content.trim();
		const parsed = JSON.parse(rawContent) as unknown;
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as Record<string, unknown>;
		}
		throw new Error("Отримано некоректний JSON від OpenAI");
	}

	throw new Error("Не вдалося отримати відповідь від OpenAI Chat Completion");
}

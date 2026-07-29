import { App, requestUrl } from "obsidian";
import { DreamAnalyzerSettings } from "./types";

interface SecretStorageApi {
	getSecret(key: string): Promise<string | undefined>;
}

interface AppWithSecretStorage extends App {
	secretStorage?: SecretStorageApi;
}

interface OpenAiEmbeddingItem {
	index: number;
	embedding: number[];
}

interface OpenAiEmbeddingResponse {
	data?: OpenAiEmbeddingItem[];
	error?: { message?: string };
}

interface OpenAiChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: { message?: string };
}

export async function getOpenAiApiKey(app: App, settings: DreamAnalyzerSettings): Promise<string> {
	let key = (settings.openaiApiKey || "").trim();

	const appWithSecret = app as AppWithSecretStorage;
	if (key && appWithSecret.secretStorage && typeof appWithSecret.secretStorage.getSecret === "function") {
		try {
			const resolvedSecret = await appWithSecret.secretStorage.getSecret(key);
			if (resolvedSecret) {
				return resolvedSecret.trim();
			}
		} catch {
			// SecretStorage fallback
		}
	}

	if (!key) {
		throw new Error("OpenAI API key не вказано у налаштуваннях плагіна!");
	}
	return key;
}

export async function getEmbedding(apiKey: string, model: string, text: string): Promise<number[]> {
	try {
		const response = await requestUrl({
			url: "https://api.openai.com/v1/embeddings",
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: model || "text-embedding-3-small",
				input: text
			})
		});

		if (response.status !== 200) {
			let errorDetail = response.text;
			try {
				const errJson = JSON.parse(response.text) as OpenAiEmbeddingResponse;
				if (errJson.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text) as OpenAiEmbeddingResponse;
		if (!data.data || !data.data[0] || !data.data[0].embedding) {
			throw new Error("Некоректний формат відповіді embeddings від OpenAI");
		}
		return data.data[0].embedding;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Помилка генерації векторного ембедінгу: ${msg}`);
	}
}

export async function getBatchEmbeddings(apiKey: string, model: string, inputs: string[]): Promise<number[][]> {
	try {
		const response = await requestUrl({
			url: "https://api.openai.com/v1/embeddings",
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: model || "text-embedding-3-small",
				input: inputs
			})
		});

		if (response.status !== 200) {
			let errorDetail = response.text;
			try {
				const errJson = JSON.parse(response.text) as OpenAiEmbeddingResponse;
				if (errJson.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text) as OpenAiEmbeddingResponse;
		if (!data.data || !Array.isArray(data.data)) {
			throw new Error("Некоректний формат відповіді embeddings від OpenAI");
		}

		const sorted = data.data.sort((a, b) => a.index - b.index);
		return sorted.map((item) => item.embedding);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Помилка генерації ембедінгів: ${msg}`);
	}
}

export async function requestChatCompletion(
	apiKey: string,
	model: string,
	systemPrompt: string,
	userPrompt: string
): Promise<Record<string, unknown>> {
	try {
		const selectedModel = model || "gpt-4o-mini";
		const payload = {
			model: selectedModel,
			messages: [
				{
					role: "system",
					content: systemPrompt
				},
				{
					role: "user",
					content: userPrompt
				}
			],
			response_format: { type: "json_object" }
		};

		const response = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		});

		if (response.status !== 200) {
			let errorDetail = response.text;
			try {
				const errJson = JSON.parse(response.text) as OpenAiChatResponse;
				if (errJson.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text) as OpenAiChatResponse;
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("Некоректна відповідь ChatCompletion від OpenAI");
		}

		const parsed = JSON.parse(content);
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as Record<string, unknown>;
		}
		throw new Error("Очікувався JSON об'єкт від OpenAI");
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Помилка запиту до OpenAI: ${msg}`);
	}
}

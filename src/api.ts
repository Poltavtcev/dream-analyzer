import { App, requestUrl } from "obsidian";
import { DreamAnalyzerSettings } from "./types";

export async function getOpenAiApiKey(app: App, settings: DreamAnalyzerSettings): Promise<string> {
	let key = (settings.openaiApiKey || "").trim();

	// If key is set via SecretStorage (keyName), attempt to retrieve from native SecretStorage
	const secretStorage = (app as any).secretStorage;
	if (key && secretStorage && typeof secretStorage.getSecret === "function") {
		try {
			const resolvedSecret = await secretStorage.getSecret(key);
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
				const errJson = JSON.parse(response.text);
				if (errJson?.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text);
		if (!data.data || !data.data[0] || !data.data[0].embedding) {
			throw new Error("Некоректний формат відповіді embeddings від OpenAI");
		}
		return data.data[0].embedding;
	} catch (error: any) {
		throw new Error(`Помилка генерації векторного ембедінгу: ${error?.message || error}`);
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
				const errJson = JSON.parse(response.text);
				if (errJson?.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text);
		if (!data.data || !Array.isArray(data.data)) {
			throw new Error("Некоректний формат відповіді embeddings від OpenAI");
		}

		const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
		return sorted.map((item: any) => item.embedding);
	} catch (error: any) {
		throw new Error(`Помилка генерації ембедінгів: ${error?.message || error}`);
	}
}

export async function requestChatCompletion(
	apiKey: string,
	model: string,
	systemPrompt: string,
	userPrompt: string
): Promise<any> {
	try {
		const selectedModel = model || "gpt-4o-mini";
		const payload: any = {
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
				const errJson = JSON.parse(response.text);
				if (errJson?.error?.message) {
					errorDetail = errJson.error.message;
				}
			} catch {
				// Silent JSON parse fallback
			}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text);
		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			throw new Error("Некоректна відповідь ChatCompletion від OpenAI");
		}

		return JSON.parse(data.choices[0].message.content);
	} catch (error: any) {
		throw new Error(`Помилка запиту до OpenAI: ${error?.message || error}`);
	}
}

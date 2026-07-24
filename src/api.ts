import { App, requestUrl } from "obsidian";
import { DreamAnalyzerSettings } from "./types";

export async function getOpenAiApiKey(app: App, settings: DreamAnalyzerSettings): Promise<string> {
	if (settings.openaiApiKey && settings.openaiApiKey.trim().length > 0) {
		return settings.openaiApiKey.trim();
	}

	throw new Error(`OpenAI API key не вказано! Будь ласка, вкажіть API ключ у налаштуваннях плагіна "Dream Analyzer".`);
}

export async function getEmbedding(
	apiKey: string,
	model: string,
	input: string
): Promise<number[]> {
	const batch = await getBatchEmbeddings(apiKey, model, [input]);
	if (!batch || batch.length === 0) {
		throw new Error("Пакети ембедінгів повернули порожній масив");
	}
	return batch[0];
}

export async function getBatchEmbeddings(
	apiKey: string,
	model: string,
	inputs: string[]
): Promise<number[][]> {
	if (!inputs || inputs.length === 0) return [];
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
			} catch (e) {}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text);
		if (!data.data || !Array.isArray(data.data)) {
			throw new Error("Некоректний формат відповіді embeddings від OpenAI");
		}

		const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
		return sorted.map((item: any) => item.embedding);
	} catch (error: any) {
		console.error("Dream Analyzer Batch Embedding Error:", error);
		throw new Error(`Помилка генерації ембедінгів: ${error.message || error}`);
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
			} catch (e) {}
			throw new Error(`OpenAI API Error ${response.status}: ${errorDetail}`);
		}

		const data = JSON.parse(response.text);
		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			throw new Error("Некоректна відповідь ChatCompletion від OpenAI");
		}

		return JSON.parse(data.choices[0].message.content);
	} catch (error: any) {
		console.error("Dream Analyzer ChatCompletion Error:", error);
		throw new Error(`Помилка запиту до OpenAI: ${error.message || error}`);
	}
}

import { moment } from "obsidian";

export type Locale = "uk" | "en";

export function getLocale(): Locale {
	try {
		const getLangFn = (window as any).getLanguage;
		const obsLang = typeof getLangFn === "function" ? String(getLangFn()).toLowerCase() : "";
		if (obsLang) {
			if (obsLang.startsWith("uk") || obsLang.startsWith("ua")) {
				return "uk";
			}
			return "en";
		}

		const momentLang = (moment.locale() || "").toLowerCase();
		if (momentLang.startsWith("uk") || momentLang.startsWith("ua")) {
			return "uk";
		}
	} catch {
		// Silent catch for language detection fallback
	}
	return "en";
}

const strings = {
	uk: {
		// Dashboard
		dashboardFileName: "Дашборд снів.md",
		dashboardTitle: "# Дашборд сновидінь та аналітики",
		dashboardCallout: "> [!INFO] Аналітика та статистика\n> Цей дашборд автоматично створено плагіном **Dream Analyzer**. Він містить ключові Dataview-запити для відстеження статистики снів, маркерів усвідомленості (Dream Signs), емоційного фону та ідей для творчості.",
		dashboardSectionStats: "## Статистика щоденника та усвідомленості (ОС)",
		dashboardSectionSigns: "## Маркери снів для усвідомлення (Dream Signs)\n*Найчастіші символи, персонажі та місця — ваші тригери для перевірки реальності у сні.*",
		dashboardSectionEmotions: "## Емоційний фон та психологічні стани\n*Емоції та внутрішні стани, які найчастіше виникають у сновидіннях.*",
		dashboardSectionCreative: "## Світ снів: Концепти & Ідеї для творчості та книг\n*Абстрактні ідеї, унікальні локації та яскраві персонажі з описом.*",
		dashboardSectionLucid: "## Усвідомлені сновидіння (ОС)\n*Журнал ваших успішних усвідомлених снів.*",
		dashboardSectionRecent: "## Останні записи щоденника",

		// Ribbon & Commands
		ribbonAnalyze: "Аналізувати сон (Dream Analyzer)",
		ribbonCreateDream: "Створити сон на сьогодні",
		cmdAnalyze: "Аналізувати активний сон",
		cmdCreateDream: "Створити сон на сьогодні",
		cmdCreateCustomDateDream: "Створити сон за обрану дату...",
		cmdRebuildEmbeddings: "Оновити ембедінги сутностей",
		cmdResetAllData: "Скинути всі проаналізовані дані та сутності...",
		contextMenuAnalyze: "Аналізувати сон",

		// Date Modal
		dateModalTitle: "Оберіть дату сну",
		dateModalLabel: "Дата сну",
		dateModalButton: "Створити / Відкрити сон",

		// Reset Modal & Settings
		resetModalTitle: "Очищення всіх знайдених сутностей та векторної бази",
		resetModalDesc: "Це видалить усі нотатки сутностей, обнулить векторні бази (embeddings.json) та скине проаналізований AI-вміст усіх снів до початкового стану. Тексти самих снів залишаться недоторканими.",
		resetModalConfirmButton: "Скинути все",
		resetModalCancelButton: "Скасувати",
		resetSuccess: "Скинуто снів: {dreams}, видалено файлів сутностей: {entities}.",
		resetSectionTitle: "Скинути та очистити дані",
		resetSectionDesc: "Видалити всі згенеровані сутності та скинути сни до початкового стану для повторного аналізу",
		resetButtonText: "Очистити всі сутності та аналіз",

		// Templater Exporter
		templateExportSuccess: "Шаблон для Templater / Calendar успішно збережено у {path}!",
		templateExportName: "Шаблон для Templater & Calendar",
		templateExportDesc: "Зберегти сумісний шаблон нотатки сну у Vault для плагінів Templater та Calendar",
		templatePathName: "Шлях до файлу шаблону",
		templatePathDesc: "Файл у сховищі, куди буде записано шаблон (наприклад, Templates/Dream Template.md)",
		templateExportButtonText: "Створити / оновити файл шаблону",

		// Notices
		noActiveNote: "Немає відкритої нотатки сну",
		openDreamNoteFirst: "Будь ласка, відкрийте нотатку сну для аналізу.",
		noApiKey: "OpenAI API key не вказано! Будь ласка, вкажіть API ключ у налаштуваннях плагіна Dream Analyzer.",
		analyzingStep1: "Аналізую сон: генерація векторних даних...",
		analyzingStep2: "Аналізую сон: пошук схожих сутностей...",
		analyzingStep3: "Аналізую сон: запит до OpenAI ({model})...",
		analyzingStep4: "Створення сутностей та розрахунок зв'язків...",
		analyzingStep5: "Пакетне оновлення векторних ембедінгів...",
		analysisSuccess: "Сон успішно проаналізовано за {sec}с!",
		analysisError: "Помилка аналізу сну: ",
		rebuildStart: "Генерація векторних ембедінгів...",
		rebuildSuccess: "Готово! Згенеровано/оновлено ембедінгів: {count}",
		dreamAlreadyExists: "Нотатка сну на цю дату вже існує!",
		dreamCreated: "Створено нову нотатку сну!",

		// Days & Months
		days: ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"],
		months: [
			"01 - січень", "02 - лютий", "03 - березень", "04 - квітень",
			"05 - травень", "06 - червень", "07 - липень", "08 - серпень",
			"09 - вересень", "10 - жовтень", "11 - листопад", "12 - грудень"
		],

		// Settings
		settingsTitle: "Налаштування Dream Analyzer",
		apiKeyName: "OpenAI API Key",
		apiKeyDesc: "Введіть свій секретний API ключ OpenAI (sk-...)",
		modelName: "Модель OpenAI Chat",
		modelDesc: "Виберіть модель AI для аналізу сну",
		gptDefaultLabel: "GPT-5 mini (За замовчуванням)",
		sectionJournalFolder: "Структура щоденника снів",
		sectionVectorSearch: "Векторний пошук та Ембедінги",
		dreamsFolderName: "Головна папка щоденника снів",
		dreamsFolderDesc: "Загальна папка (наприклад, Усвідомлені сновидіння або Dreams). Плагін сам створить папки 'Сни', 'Сутності' та Дашборд всередині.",
		autoEmbeddingsName: "Авто-оновлення ембедінгів",
		autoEmbeddingsDesc: "Автоматично оновлювати векторні ембедінги після аналізу сну",
		embeddingModelName: "Модель ембедінгів",
		embeddingModelDesc: "Модель OpenAI для векторизації (за замовчуванням: text-embedding-3-small)",
		thresholdName: "Поріг схожості (Similarity Threshold)",
		thresholdDesc: "Мінімальний поріг схожості для сутностей (від 0.0 до 1.0)",
		limitName: "Ліміт схожих сутностей",
		limitDesc: "Максимальна кількість схожих сутностей у контексті AI",
		rebuildButtonName: "Ручне оновлення бази ембедінгів сутностей",
		rebuildButtonDesc: "Просканувати всі нотатки сутностей та обчислити відсутні ембедінги",
		rebuildButtonText: "Перебудувати всі ембедінги"
	},
	en: {
		// Dashboard
		dashboardFileName: "Dream Dashboard.md",
		dashboardTitle: "# Dream Analytics Dashboard",
		dashboardCallout: "> [!INFO] Analytics & Statistics\n> This dashboard is automatically generated by **Dream Analyzer**. It contains key Dataview queries for tracking dream stats, Dream Signs (reality checks), emotional trends, and creative ideas.",
		dashboardSectionStats: "## Journal & Lucid Dreaming Statistics",
		dashboardSectionSigns: "## Dream Signs & Reality Check Triggers\n*Most frequent symbols, characters, and places — your reality check triggers in dreams.*",
		dashboardSectionEmotions: "## Emotional Background & Psychological States\n*Emotions and internal mental states most frequently experienced in dreams.*",
		dashboardSectionCreative: "## Dream World: Concepts & Creative Ideas\n*Abstract concepts, unique locations, and vivid characters with descriptions.*",
		dashboardSectionLucid: "## Lucid Dreams (LD)\n*Journal of your successful lucid dreams.*",
		dashboardSectionRecent: "## Recent Dream Journal Entries",

		// Ribbon & Commands
		ribbonAnalyze: "Analyze dream (Dream Analyzer)",
		ribbonCreateDream: "Create dream note for today",
		cmdAnalyze: "Analyze active dream",
		cmdCreateDream: "Create dream note for today",
		cmdCreateCustomDateDream: "Create dream note for selected date...",
		cmdRebuildEmbeddings: "Rebuild entity embeddings",
		cmdResetAllData: "Reset all analyzed data and entities...",
		contextMenuAnalyze: "Analyze dream",

		// Date Modal
		dateModalTitle: "Select Dream Date",
		dateModalLabel: "Dream Date",
		dateModalButton: "Create / Open Dream",

		// Reset Modal & Settings
		resetModalTitle: "Reset All Analyzed Data and Entities",
		resetModalDesc: "This will delete all created entity notes, clear vector database files (embeddings.json), and reset analyzed AI content in all dreams to their initial template state. Your original dream texts will remain untouched.",
		resetModalConfirmButton: "Reset All",
		resetModalCancelButton: "Cancel",
		resetSuccess: "Reset dreams: {dreams}, deleted entity files: {entities}.",
		resetSectionTitle: "Reset & Clear Data",
		resetSectionDesc: "Delete all generated entities and reset dream notes to initial template state for re-analysis",
		resetButtonText: "Clear All Entities & Analysis",

		// Templater Exporter
		templateExportSuccess: "Templater / Calendar template successfully saved to {path}!",
		templateExportName: "Templater & Calendar Template",
		templateExportDesc: "Save a compatible dream note template file in Vault for Templater and Calendar plugins",
		templatePathName: "Template File Path",
		templatePathDesc: "Vault file path where template will be written (e.g. Templates/Dream Template.md)",
		templateExportButtonText: "Create / Update Template File",

		// Notices
		noActiveNote: "No active dream note open",
		openDreamNoteFirst: "Please open a dream note to analyze.",
		noApiKey: "OpenAI API key is missing! Please enter your API key in Dream Analyzer settings.",
		analyzingStep1: "Analyzing dream: generating vector embeddings...",
		analyzingStep2: "Analyzing dream: searching for similar entities...",
		analyzingStep3: "Analyzing dream: sending request to OpenAI ({model})...",
		analyzingStep4: "Creating entities and connections...",
		analyzingStep5: "Batch updating vector embeddings...",
		analysisSuccess: "Dream analyzed successfully in {sec}s!",
		analysisError: "Dream analysis error: ",
		rebuildStart: "Generating vector embeddings...",
		rebuildSuccess: "Done! Generated/updated embeddings: {count}",
		dreamAlreadyExists: "Dream note for this date already exists!",
		dreamCreated: "Created new dream note!",

		// Days & Months
		days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
		months: [
			"01 - January", "02 - February", "03 - March", "04 - April",
			"05 - May", "06 - June", "07 - July", "08 - August",
			"09 - September", "10 - October", "11 - November", "12 - December"
		],

		// Settings
		settingsTitle: "Dream Analyzer Settings",
		apiKeyName: "OpenAI API Key",
		apiKeyDesc: "Enter your secret OpenAI API Key (sk-...)",
		modelName: "OpenAI Chat Model",
		modelDesc: "Select AI model for dream analysis",
		gptDefaultLabel: "GPT-5 mini (Default)",
		sectionJournalFolder: "Dream Journal Folder Structure",
		sectionVectorSearch: "Vector Search & Embeddings",
		dreamsFolderName: "Main Dream Journal Folder",
		dreamsFolderDesc: "Main folder (e.g. Dreams or Lucid Dreaming). The plugin will automatically manage 'Dreams', 'Entities', and Dashboard subfolders inside.",
		autoEmbeddingsName: "Auto-update Embeddings",
		autoEmbeddingsDesc: "Automatically update vector embeddings after dream analysis",
		embeddingModelName: "Embedding Model",
		embeddingModelDesc: "OpenAI model for vectorization (default: text-embedding-3-small)",
		thresholdName: "Similarity Threshold",
		thresholdDesc: "Minimum similarity threshold for entities (from 0.0 to 1.0)",
		limitName: "Similar Entities Limit",
		limitDesc: "Maximum number of similar entities in AI context",
		rebuildButtonName: "Manual Entity Embeddings Update",
		rebuildButtonDesc: "Scan all entity notes and calculate missing embeddings",
		rebuildButtonText: "Rebuild All Embeddings"
	}
};

export function t(key: keyof typeof strings["uk"], vars?: Record<string, string | number>): any {
	const locale = getLocale();
	let template = (strings[locale] && strings[locale][key]) || strings["en"][key] || strings["uk"][key] || "";
	if (typeof template === "string" && vars) {
		for (const [k, v] of Object.entries(vars)) {
			template = template.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
		}
	}
	return template;
}

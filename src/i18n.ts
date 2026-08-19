import { moment } from "obsidian";

export type Locale = "uk" | "en";

export function getLocale(): Locale {
	try {
		const win = window as Record<string, unknown>;
		const getLangFn = win.getLanguage as (() => string) | undefined;
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

		if (typeof navigator !== "undefined" && navigator.language) {
			const navLang = navigator.language.toLowerCase();
			if (navLang.startsWith("uk") || navLang.startsWith("ua")) {
				return "uk";
			}
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

		// Dataview notice
		dataviewNotice: "Для відображення інтерактивних таблиць у Дашборді та Індексах рекомендовано встановити плагін Dataview.",

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

		// Notices & Alerts
		openDreamNoteFirst: "Будь ласка, відкрийте нотатку сну",
		dreamAlreadyExists: "Нотатка сну на цю дату вже існує",
		dreamCreated: "Створено нотатку сну",
		templateExportSuccess: "Шаблон для Templater успішно експортовано в {path}",
		noDreamNoteOpen: "Немає відкритої нотатки сну",
		dreamTextTooShort: "Текст сну занадто короткий або відсутній! Заповніть опис сну у нотатці.",
		rebuildStarted: "Розпочато пакетне оновлення ембедінгів...",
		rebuildSuccess: "Оновлено ембедінги для {count} сутностей!",
		rebuildError: "Помилка оновлення ембедінгів: {msg}",
		dreamAnalyzedSuccess: "Сон успішно проаналізовано за {sec}с!",

		connDreamSigns: "Спільні Dream Signs",
		connEmotions: "Емоційний резонанс",
		connNarrative: "Сюжетна схожість",

		// Progress Steps
		step1VectorGen: "Генерація векторних даних сну...",
		step2SearchEntities: "Пошук схожих сутностей...",
		step3OpenAiReq: "Запит до OpenAI ({model})...",
		step4CreateEntities: "Створення сутностей та розрахунок зв'язків...",
		step5BatchUpdate: "Пакетне оновлення векторних ембедінгів...",

		// Settings Tab
		settingsTitle: "Налаштування аналізатора снів (Dream Analyzer)",
		sectionOpenAi: "Параметри OpenAI API",
		apiKeyName: "OpenAI API Key",
		apiKeyDesc: "Введіть свій персональний API ключ OpenAI (або збережіть його в Obsidian SecretStorage). Ключ зберігається надійно.",
		selectSecretStorageKey: "-- Обрати ключ із SecretStorage --",
		apiKeyPlaceholder: "sk-... або ім'я секрету з SecretStorage",
		modelName: "Модель аналізу снів",
		modelDesc: "Модель OpenAI GPT для аналізу тексу снів та вилучення сутностей.",
		embeddingModelName: "Модель векторних ембедінгів",
		embeddingModelDesc: "Модель для розрахунку векторної схожості між снами та сутностями.",

		sectionFolders: "Папки та структури",
		dreamsFolderName: "Папка зберігання снів та сутностей",
		dreamsFolderDesc: "Базова папка у ваульті для снів, сутностей та векторних баз.",
		templatePathName: "Шлях до шаблону Templater",
		templatePathDesc: "Шлях для експорту шаблону, сумісного з Templater / Calendar.",
		btnExportTemplate: "Експортувати шаблон для Templater",

		sectionSimilarity: "Параметри схожості та зв'язків",
		thresholdName: "Поріг схожості сутностей (старий)",
		thresholdDesc: "Мінімальний косинусний коефіцієнт для підтягування схожих сутностей (Deprecated).",
		narrativeThresholdName: "Поріг сюжетної схожості (Narrative)",
		narrativeThresholdDesc: "Мінімальна векторна схожість (vecSim) для зв'язку снів за сюжетом/атмосферою (0.0 - 1.0).",
		dreamSignFreqName: "Максимальна частота Dream Sign",
		dreamSignFreqDesc: "Максимальна кількість снів, у яких може з'являтися об'єкт/персонаж, щоб вважатися унікальним зв'язком.",
		emotionFreqName: "Максимальна частота емоції",
		emotionFreqDesc: "Максимальна кількість снів, у яких може зустрічатися емоція, щоб створити емоційний зв'язок.",
		limitName: "Ліміт схожих сутностей",
		limitDesc: "Максимальна кількість сутностей, які передаються у контексті до OpenAI.",
		autoUpdateName: "Автоматично оновлювати ембедінги",
		autoUpdateDesc: "Автоматично розраховувати та оновлювати векторні дані сутностей після аналізу сну.",

		sectionMaintenance: "Обслуговування та Скидання",
		btnRebuildEmbeddings: "Оновити всі ембедінги сутностей",
		resetBlockTitle: "Скидання аналітичних даних",
		resetBlockDesc: "Видалити всі сутності, оновлені дати та повернути початковий AI-стан снів",
		btnResetData: "Скинути всі дані"
	},
	en: {
		// Dashboard
		dashboardFileName: "Dream Dashboard.md",
		dashboardTitle: "# Dreams Analytics & Dashboard",
		dashboardCallout: "> [!INFO] Analytics & Statistics\n> This dashboard was automatically generated by **Dream Analyzer**. It contains Dataview queries for tracking dream statistics, Dream Signs, emotional background, and creative ideas.",
		dashboardSectionStats: "## Journal & Lucidity Statistics (LD)",
		dashboardSectionSigns: "## Dream Signs for Lucidity\n*Most frequent symbols, characters, and places — your reality check triggers.*",
		dashboardSectionEmotions: "## Emotional Background & Psychological States\n*Most frequent emotions and internal states in your dreams.*",
		dashboardSectionCreative: "## Dream World: Concepts & Creative Ideas\n*Abstract ideas, unique locations, and vivid characters with descriptions.*",
		dashboardSectionLucid: "## Lucid Dreams (LD)\n*Journal of your successful lucid dreams.*",
		dashboardSectionRecent: "## Recent Journal Entries",

		// Dataview notice
		dataviewNotice: "It is recommended to install the Dataview plugin to render interactive tables in Dashboard and Indexes.",

		// Ribbon & Commands
		ribbonAnalyze: "Analyze Dream (Dream Analyzer)",
		ribbonCreateDream: "Create Today's Dream",
		cmdAnalyze: "Analyze Active Dream Note",
		cmdCreateDream: "Create Today's Dream Note",
		cmdCreateCustomDateDream: "Create Dream Note for Selected Date...",
		cmdRebuildEmbeddings: "Rebuild Entity Embeddings",
		cmdResetAllData: "Reset All Analysis Data & Entities...",
		contextMenuAnalyze: "Analyze Dream",

		// Date Modal
		dateModalTitle: "Select Dream Date",
		dateModalLabel: "Dream Date",
		dateModalButton: "Create / Open Dream",

		// Reset Modal & Settings
		resetModalTitle: "Reset All Entities & Embeddings Database",
		resetModalDesc: "This will delete all entity notes, clear vector databases (embeddings.json), and reset analyzed AI content in all dreams. Your original dream texts will remain untouched.",
		resetModalConfirmButton: "Reset Everything",
		resetModalCancelButton: "Cancel",
		resetSuccess: "Reset dreams: {dreams}, deleted entity files: {entities}.",

		// Notices & Alerts
		openDreamNoteFirst: "Please open a dream note first",
		dreamAlreadyExists: "A dream note for this date already exists",
		dreamCreated: "Created dream note",
		templateExportSuccess: "Templater template exported to {path}",
		noDreamNoteOpen: "No open dream note",
		dreamTextTooShort: "Dream text is too short or missing! Please fill in the dream description in the note.",
		rebuildStarted: "Started batch updating embeddings...",
		rebuildSuccess: "Updated embeddings for {count} entities!",
		rebuildError: "Error updating embeddings: {msg}",
		dreamAnalyzedSuccess: "Dream successfully analyzed in {sec}s!",

		connDreamSigns: "Shared Dream Signs",
		connEmotions: "Emotional Resonance",
		connNarrative: "Narrative similarity",

		// Progress Steps
		step1VectorGen: "Generating dream vector embeddings...",
		step2SearchEntities: "Searching for similar entities...",
		step3OpenAiReq: "Requesting OpenAI ({model})...",
		step4CreateEntities: "Creating entities and calculating connections...",
		step5BatchUpdate: "Batch updating vector embeddings...",

		// Settings Tab
		settingsTitle: "Dream Analyzer Settings",
		sectionOpenAi: "OpenAI API Parameters",
		apiKeyName: "OpenAI API Key",
		apiKeyDesc: "Enter your personal OpenAI API Key (or store it in Obsidian SecretStorage). Key is kept secure.",
		selectSecretStorageKey: "-- Select key from SecretStorage --",
		apiKeyPlaceholder: "sk-... or secret name from SecretStorage",
		modelName: "Dream Analysis Model",
		modelDesc: "OpenAI GPT model for analyzing dream texts and extracting entities.",
		embeddingModelName: "Vector Embedding Model",
		embeddingModelDesc: "Model for calculating vector similarity between dreams and entities.",

		sectionFolders: "Folders & Structure",
		dreamsFolderName: "Dreams & Entities Storage Folder",
		dreamsFolderDesc: "Base folder in vault for dreams, entities, and vector databases.",
		templatePathName: "Templater Template Path",
		templatePathDesc: "Path for exporting Templater / Calendar compatible template.",
		btnExportTemplate: "Export Templater Template",

		sectionSimilarity: "Similarity & Connection Parameters",
		thresholdName: "Entity Similarity Threshold (old)",
		thresholdDesc: "Minimum cosine similarity score for matching existing entities (Deprecated).",
		narrativeThresholdName: "Narrative Similarity Threshold",
		narrativeThresholdDesc: "Minimum vector similarity (vecSim) to connect dreams by plot/atmosphere (0.0 - 1.0).",
		dreamSignFreqName: "Max Dream Sign Frequency",
		dreamSignFreqDesc: "Maximum number of dreams an object/character can appear in to be considered a unique connection.",
		emotionFreqName: "Max Emotion Frequency",
		emotionFreqDesc: "Maximum number of dreams an emotion can appear in to create an emotional connection.",
		limitName: "Similar Entities Limit",
		limitDesc: "Maximum number of existing entities provided in context to OpenAI.",
		autoUpdateName: "Auto Update Embeddings",
		autoUpdateDesc: "Automatically calculate and update vector embeddings after dream analysis.",

		sectionMaintenance: "Maintenance & Reset",
		btnRebuildEmbeddings: "Rebuild All Entity Embeddings",
		resetBlockTitle: "Reset Analytics Data",
		resetBlockDesc: "Delete all entities, reset timestamps, and return dreams to initial AI state",
		btnResetData: "Reset All Data"
	}
};

export function t(key: keyof typeof strings["uk"], vars?: Record<string, string | number>): string {
	const lang = getLocale();
	const dict = strings[lang] || strings["en"];
	let str = dict[key] || strings["en"][key] || key;

	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
		}
	}
	return str;
}

export function tList(key: "months" | "days"): string[] {
	const lang = getLocale();
	if (lang === "uk") {
		return key === "months"
			? ["01 - січень", "02 - лютий", "03 - березень", "04 - квітень", "05 - травень", "06 - червень", "07 - липень", "08 - серпень", "09 - вересень", "10 - жовтень", "11 - листопад", "12 - грудень"]
			: ["неділя", "понеділок", "вівторок", "середа", "четвер", "п’ятниця", "субота"];
	}
	return key === "months"
		? ["01 - January", "02 - February", "03 - March", "04 - April", "05 - May", "06 - June", "07 - July", "08 - August", "09 - September", "10 - October", "11 - November", "12 - December"]
		: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
}

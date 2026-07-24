# 🌙 Dream Analyzer for Obsidian

**Dream Analyzer** is an AI-powered Obsidian plugin for dream journal analysis, automatic entity extraction (Characters, Places, Objects, Emotions, Symbols, Concepts), vector similarity search between dreams, and Lucid Dreaming tracking.

---

## 🚀 Features

- **🧠 AI-Powered Dream Analysis**: Generates structured dream summaries and extracts entities using OpenAI API (`gpt-5-mini`, `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`).
- **👤 Automatic Entity Management**: Creates and updates note files in `Characters`, `Places`, `Objects`, `Emotions`, `Symbols`, and `Concepts` folders, preserving appearance history and dream contexts.
- **⚡ Vector Embeddings & Similarity Matching**: Calculates combined similarity scores between dreams (50% Cosine Similarity + 50% Shared Entities) and displays TOP-5 connected dreams.
- **📊 Automated Dream Analytics Dashboard (`Дашборд снів.md`)**: Tracks lucid dreaming metrics (% Lucid Dreams), Dream Signs / Reality Check triggers, emotional trends, and creative writing ideas.
- **📅 Calendar & Templater Integration**: Exports a ready-to-use template file compatible with Templater and Calendar plugins.
- **🗓 Flexible Date Picker**: Commands to create today's dream note or pick any custom date via an interactive date-picker modal.
- **🧹 Native Reset & Cleanup**: Native Obsidian Frontmatter processing (zero regex string manipulation) and a full data reset utility for fresh testing.
- **🔄 Real-time Rename Sync**: Automatically updates vector database paths in real-time when dream or entity files are renamed in Obsidian.

---

## 📦 Installation

1. Copy the `dream-analyzer` directory into `.obsidian/plugins/` inside your Obsidian vault.
2. Ensure the plugin directory contains:
   - `main.js`
   - `manifest.json`
3. Enable the plugin in **Obsidian Settings -> Community plugins -> Dream Analyzer**.

---

## ⚙️ Configuration

1. **OpenAI API Key**: Enter your OpenAI API Key (`sk-...`).
2. **OpenAI Chat Model**: Select your preferred AI model (`gpt-5-mini` default or `gpt-4o-mini` for ultra-fast response).
3. **Dreams Folder**: Folder path where dream notes are stored (default: `Dreams`).
4. **Entities Folder**: Folder path where entity notes are created (default: `Entities`).
5. **Templater & Calendar Template**: Click `💾 Create / Update Template File` to generate `Templates/Dream Template.md`.

---

## 📖 How to Use

1. **Create a Dream Note**:
   - Click the calendar ribbon icon or run the command `🌙 Create Dream Note for Today`.
   - For a custom date, run `📅 Create Dream Note for Selected Date...`.
2. **Analyze a Dream**:
   - Open a dream note and click the brain ribbon icon 🧠 or run `🧠 Analyze Active Dream`.
   - Alternatively, right-click any dream file in the File Explorer and select `🧠 Analyze Dream`.
3. **View Dashboard**:
   - Open `Дашборд снів.md` inside your Dreams folder to view live Dataview analytics.

---

## 🛠 Technical Specifications

- **Language**: TypeScript
- **Bundler**: ESBuild (bundle size ~88 KB)
- **API**: Obsidian Native Frontmatter API (`app.fileManager.processFrontMatter`), Obsidian RequestUrl, OpenAI ChatCompletions & Embeddings Batch API.

---

## 📄 License

MIT License.

# 🌙 Dream Analyzer for Obsidian

**Dream Analyzer** is an AI-assisted dream journaling plugin for Obsidian.

It helps organize dream journals by analyzing dream entries, extracting structured entities, discovering connections between dreams, and tracking recurring themes.

Dream Analyzer uses AI to assist reflection and organization. It does not provide psychological or medical interpretations.

---

## 🚀 Features

### 🧠 AI Dream Analysis

Automatically analyzes dream entries and generates structured information:

- Dream summaries
- Characters
- Places
- Objects
- Emotions
- Symbols
- Concepts

Supports OpenAI models including:

- `gpt-4o-mini`
- `gpt-4o`
- `gpt-5-mini`

---

### 👤 Entity Management

Automatically creates and updates entity notes:

- Characters
- Places
- Objects
- Emotions
- Symbols
- Concepts

Entity notes preserve:

- Appearance history
- Related dreams
- Recurring contexts
- Connections between experiences

Includes smart duplicate prevention across categories.

---

### 🔗 Dream Similarity Analysis

Finds related dreams using combined semantic and entity-based matching:

- 50% Vector Cosine Similarity
- 50% Shared Entity Similarity

Displays the most connected dreams based on:

- Semantic meaning
- Recurring entities
- Shared themes

---

### 📊 Dream Analytics Dashboard & Indexes

Automatically generates a dream dashboard and separate index notes:

- Journal and lucidity statistics
- Dream signs and reality check triggers
- Emotional trends
- Recurring concepts and creative ideas
- Separate Index folder (`Index/` or `Індекс/`) for character, place, object, emotion, symbol, and concept tables.

---

### 📅 Calendar and Templater Integration

Provides:

- Dream note templates
- Templater compatibility
- Calendar integration
- Date picker modal for creating historical dream entries

---

### 🔄 Real-Time Synchronization

Automatically updates internal references when:

- Dream notes are renamed
- Entity notes are renamed
- Files are moved inside the vault

---

### 🧹 Data Management

Includes utilities for:

- Database reset
- Cleanup of generated data
- Rebuilding analysis indexes

Uses native Obsidian APIs for frontmatter processing.

---

## 🔌 Requirements

For live interactive tables in the Dashboard and Index pages, installing the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin is highly recommended.

---

## ⚙️ Configuration

1. Open Obsidian **Settings** -> **Dream Analyzer**.
2. Enter your **OpenAI API Key** (or save it securely via Obsidian SecretStorage).
3. Select your preferred **AI Model** and **Embedding Model**.
4. Set your base **Dreams Storage Folder** (defaults to `Dreams`).

---

## 📦 Installation

### Via Obsidian Community Plugins (Upcoming)

Search for **Dream Analyzer** in Obsidian's Community Plugins directory and click **Install**.

### Manual Installation

1. Download `main.js` and `manifest.json` from the latest GitHub Release.
2. Create a folder in your vault: `.obsidian/plugins/dream-analyzer/`
3. Copy `main.js` and `manifest.json` into `.obsidian/plugins/dream-analyzer/`
4. Reload Obsidian plugins and enable **Dream Analyzer**.

---

## 📄 License

This project is licensed under the MIT License.

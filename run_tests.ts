import { formatDreamConnectionsMarkdown } from "./src/embeddings";
import { DreamConnectionResult } from "./src/types";

// Mock Obsidian
(global as any).window = { localStorage: { getItem: () => "uk" } };

const mockConnections: DreamConnectionResult[] = [
    {
        dreamFile: "test1.md", dreamName: "Dream 1", date: "2026-08-01",
        signals: {
            narrative: { matched: true, similarity: 0.85 },
            dreamSigns: { matched: false, entities: [] },
            emotions: { matched: false, emotions: [] }
        }
    },
    {
        dreamFile: "test2.md", dreamName: "Dream 2", date: "2026-08-02",
        signals: {
            narrative: { matched: false, similarity: 0.40 },
            dreamSigns: { matched: true, entities: ["Літак", "Аеропорт"] },
            emotions: { matched: false, emotions: [] }
        }
    },
    {
        dreamFile: "test3.md", dreamName: "Dream 3", date: "2026-08-03",
        signals: {
            narrative: { matched: false, similarity: 0.30 },
            dreamSigns: { matched: false, entities: [] },
            emotions: { matched: true, emotions: ["Роздратування"] }
        }
    },
    {
        dreamFile: "test4.md", dreamName: "Dream 4", date: "2026-08-04",
        signals: {
            narrative: { matched: true, similarity: 0.90 },
            dreamSigns: { matched: true, entities: ["Вулиця"] },
            emotions: { matched: true, emotions: ["Страх"] }
        }
    }
];

const result = formatDreamConnectionsMarkdown(mockConnections);
console.log("=== Markdown Render Test ===");
console.log(result);

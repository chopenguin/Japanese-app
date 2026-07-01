import manifest from "../data/vocabulary/manifest.json";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type VocabularySummary = {
  id: string;
  folder: string;
  display: string;
  kanji: string;
  kana: string;
  meanings_zh: string[];
};

type LevelManifest = {
  count: number;
  chinese_meaning_matches: number;
  items: VocabularySummary[];
};

type VocabularyManifest = {
  generated_at: string;
  schema_version: number;
  levels: Record<JlptLevel, LevelManifest>;
};

export type Stage = {
  id: string;
  level: JlptLevel;
  number: number;
  title: string;
  words: VocabularySummary[];
};

export const jlptLevels: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export const vocabularyManifest = manifest as VocabularyManifest;

export function getLevelCount(level: JlptLevel) {
  return vocabularyManifest.levels[level].count;
}

export function getStages(level: JlptLevel): Stage[] {
  const words = vocabularyManifest.levels[level].items;

  return Array.from({ length: Math.ceil(words.length / 10) }, (_, index) => {
    const stageWords = words.slice(index * 10, index * 10 + 10);
    const first = stageWords[0]?.display ?? "";
    const last = stageWords.at(-1)?.display ?? "";

    return {
      id: `${level.toLowerCase()}-${index + 1}`,
      level,
      number: index + 1,
      title: first && last ? `${first} - ${last}` : `${level} Stage ${index + 1}`,
      words: stageWords,
    };
  });
}

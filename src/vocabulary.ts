import manifest from "../data/vocabulary/manifest.json";
import stageData from "../data/stages/stages.json";

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

type StageManifest = {
  generated_at: string;
  schema_version: number;
  seed: string;
  words_per_stage: number;
  levels: Record<
    JlptLevel,
    {
      count: number;
      stages: Array<{
        id: string;
        number: number;
        word_ids: string[];
      }>;
    }
  >;
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
export const stageManifest = stageData as StageManifest;
const vocabularyById = new Map(
  jlptLevels.flatMap((level) =>
    vocabularyManifest.levels[level].items.map((item) => [item.id, item] as const),
  ),
);

export function getLevelCount(level: JlptLevel) {
  return vocabularyManifest.levels[level].count;
}

export function getStages(level: JlptLevel): Stage[] {
  return stageManifest.levels[level].stages.map((stage) => {
    const words = stage.word_ids
      .map((wordId) => vocabularyById.get(wordId))
      .filter((word): word is VocabularySummary => Boolean(word));

    return {
      id: stage.id,
      level,
      number: stage.number,
      title: `${level} Stage ${stage.number}`,
      words,
    };
  });
}

export function getLevelWords(level: JlptLevel) {
  return vocabularyManifest.levels[level].items;
}

export function getPrimaryJapanese(word: VocabularySummary) {
  return word.kanji || word.display;
}

export function hasSeparateKana(word: VocabularySummary) {
  return word.kana && word.kana !== getPrimaryJapanese(word);
}

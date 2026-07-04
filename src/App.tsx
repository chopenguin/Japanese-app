import { useEffect, useMemo, useState } from "react";
import {
  type BackgroundTrack,
  clearAllAppCaches,
  clearDownloadedAudio,
  downloadAudioPack,
  getMissingAudioWords,
  getVoice,
  loadBackgroundTracks,
  playAnswerFeedback,
  playWordAudio,
  setBackgroundMusic,
  setBackgroundMusicVolume,
  voiceOptions,
  type VoiceId,
} from "./audio";
import {
  getLevelWords,
  getLevelCount,
  getPrimaryJapanese,
  getStages,
  hasSeparateKana,
  jlptLevels,
  type JlptLevel,
  type Stage,
  type VocabularySummary,
} from "./vocabulary";
import { getTheme, themes, type ThemeId } from "./themes";

const levelDescriptions: Record<JlptLevel, string> = {
  N5: "入門基礎",
  N4: "日常常用",
  N3: "中級銜接",
  N2: "進階理解",
  N1: "高階表達",
};

type View =
  | "home"
  | "map"
  | "preview"
  | "game"
  | "settings"
  | "backgroundMusic"
  | "help"
  | "audioDownload"
  | "wordLevelSelect"
  | "wordList";

type WordLibraryMode = "learned" | "favorites";
type StageReviewStatus = "unplayed" | "review-due" | "review-waiting" | "mastered";

type QuestionType = "zh-to-ja" | "ja-to-zh" | "spelling";

type ChoiceQuestion = {
  id: string;
  type: "zh-to-ja" | "ja-to-zh";
  word: VocabularySummary;
  options: VocabularySummary[];
};

type SpellingQuestion = {
  id: string;
  type: "spelling";
  word: VocabularySummary;
};

type Question = ChoiceQuestion | SpellingQuestion;

type SpellingTile = {
  id: string;
  text: string;
};

type WordGroup = {
  key: string;
  label: string;
  words: VocabularySummary[];
};

type StageProgress = {
  stageId: string;
  completedAt: number;
  reviewCount: number;
  nextReviewAt: number | null;
};

type AudioDownloadProgress = {
  title: string;
  completed: number;
  total: number;
};

type AudioDownloadRequest = {
  level: JlptLevel;
  returnView: View;
  title: string;
  voiceId: VoiceId;
  voiceName: string;
  words: VocabularySummary[];
};

const hiraganaPool = Array.from(
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゃゅょっー",
);

const katakanaPool = Array.from(
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポャュョッー",
);

const learnedStorageKey = "japanese-app.learned-word-ids";
const favoriteStorageKey = "japanese-app.favorite-word-ids";
const voiceVolumeStorageKey = "japanese-app.voice-volume";
const effectVolumeStorageKey = "japanese-app.effect-volume";
const backgroundMusicStorageKey = "japanese-app.background-music";
const backgroundVolumeStorageKey = "japanese-app.background-volume";
const stageProgressStorageKey = "japanese-app.stage-progress";
const reviewIntervalsInDays = [1, 2, 4, 7, 15] as const;

const kanaRows = [
  { key: "a", label: "あ行", chars: "あいうえおぁぃぅぇぉ" },
  { key: "ka", label: "か行", chars: "かきくけこがぎぐげご" },
  { key: "sa", label: "さ行", chars: "さしすせそざじずぜぞ" },
  { key: "ta", label: "た行", chars: "たちつてとだぢづでどっ" },
  { key: "na", label: "な行", chars: "なにぬねの" },
  { key: "ha", label: "は行", chars: "はひふへほばびぶべぼぱぴぷぺぽ" },
  { key: "ma", label: "ま行", chars: "まみむめも" },
  { key: "ya", label: "や行", chars: "やゆよゃゅょ" },
  { key: "ra", label: "ら行", chars: "らりるれろ" },
  { key: "wa", label: "わ行", chars: "わをん" },
  { key: "other", label: "その他", chars: "" },
] as const;

function shuffle<T>(items: T[], seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  const random = () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };

  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function loadWordIdSet(key: string) {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (!storedValue) return new Set<string>();
    const ids = JSON.parse(storedValue);
    return Array.isArray(ids) ? new Set(ids.filter((id) => typeof id === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveWordIdSet(key: string, ids: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

function loadStageProgress() {
  try {
    const storedValue = window.localStorage.getItem(stageProgressStorageKey);
    if (!storedValue) return {} as Record<string, StageProgress>;
    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return {} as Record<string, StageProgress>;
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, StageProgress] => {
        const value = entry[1] as Partial<StageProgress>;
        return (
          typeof entry[0] === "string" &&
          typeof value.stageId === "string" &&
          typeof value.completedAt === "number" &&
          typeof value.reviewCount === "number" &&
          (typeof value.nextReviewAt === "number" || value.nextReviewAt === null)
        );
      }),
    );
  } catch {
    return {} as Record<string, StageProgress>;
  }
}

function saveStageProgress(progress: Record<string, StageProgress>) {
  window.localStorage.setItem(stageProgressStorageKey, JSON.stringify(progress));
}

function loadVolume(storageKey: string, fallback: number) {
  const stored = Number(window.localStorage.getItem(storageKey));
  if (!Number.isFinite(stored)) return fallback;
  return Math.max(0, Math.min(100, stored));
}

function toHiragana(value: string) {
  return value.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function getWordSortKey(word: VocabularySummary) {
  return toHiragana(word.kana || getPrimaryJapanese(word));
}

function getKanaRowKey(word: VocabularySummary) {
  const firstKana = Array.from(getWordSortKey(word)).find((char) =>
    /[\u3040-\u309f]/u.test(char),
  );
  if (!firstKana) return "other";

  return kanaRows.find((row) => row.chars.includes(firstKana))?.key ?? "other";
}

function groupWordsByKanaRow(words: VocabularySummary[]): WordGroup[] {
  const sortedWords = [...words].sort((left, right) =>
    getWordSortKey(left).localeCompare(getWordSortKey(right), "ja"),
  );

  return kanaRows
    .map((row) => ({
      key: row.key,
      label: row.label,
      words: sortedWords.filter((word) => getKanaRowKey(word) === row.key),
    }))
    .filter((group) => group.words.length > 0);
}

function getReviewStatus(progress: StageProgress | undefined, now = Date.now()): StageReviewStatus {
  if (!progress) return "unplayed";
  if (progress.reviewCount >= reviewIntervalsInDays.length) return "mastered";
  if (progress.nextReviewAt !== null && progress.nextReviewAt <= now) return "review-due";
  return "review-waiting";
}

function getDemoStageProgress(stage: Stage): StageProgress | undefined {
  if (stage.level !== "N5") return undefined;

  const now = Date.now();
  const baseProgress = {
    stageId: stage.id,
    completedAt: now - 1000 * 60 * 60 * 24 * 2,
  };

  if (stage.number === 2) {
    return {
      ...baseProgress,
      reviewCount: 1,
      nextReviewAt: now - 1000 * 60 * 60,
    };
  }

  if (stage.number === 3) {
    return {
      ...baseProgress,
      reviewCount: 2,
      nextReviewAt: now + 1000 * 60 * 60 * 24 * 3,
    };
  }

  if (stage.number === 4) {
    return {
      ...baseProgress,
      reviewCount: reviewIntervalsInDays.length,
      nextReviewAt: null,
    };
  }

  return undefined;
}

function getStageStatus(
  stage: Stage,
  progressByStageId: Record<string, StageProgress>,
) {
  return getReviewStatus(progressByStageId[stage.id] ?? getDemoStageProgress(stage));
}

function getNextStageProgress(stage: Stage, currentProgress: StageProgress | undefined) {
  const now = Date.now();
  const nextReviewCount = Math.min(
    (currentProgress?.reviewCount ?? 0) + 1,
    reviewIntervalsInDays.length,
  );
  const isMastered = nextReviewCount >= reviewIntervalsInDays.length;
  const intervalDays = reviewIntervalsInDays[nextReviewCount - 1] ?? 0;

  return {
    stageId: stage.id,
    completedAt: now,
    reviewCount: nextReviewCount,
    nextReviewAt: isMastered ? null : now + intervalDays * 24 * 60 * 60 * 1000,
  };
}

function buildQuestionOptions(
  word: VocabularySummary,
  pool: VocabularySummary[],
  seed: string,
) {
  const distractors = shuffle(
    pool.filter((item) => item.id !== word.id),
    seed,
  ).slice(0, 3);

  return shuffle([word, ...distractors], `${seed}:options`);
}

function buildQuestions(stage: Stage, pool: VocabularySummary[], runSeed: string) {
  const questions = stage.words.flatMap<Question>((word) => [
    {
      id: `${runSeed}:${word.id}:zh-to-ja`,
      type: "zh-to-ja",
      word,
      options: buildQuestionOptions(word, pool, `${runSeed}:${word.id}:zh`),
    },
    {
      id: `${runSeed}:${word.id}:ja-to-zh`,
      type: "ja-to-zh",
      word,
      options: buildQuestionOptions(word, pool, `${runSeed}:${word.id}:ja`),
    },
    {
      id: `${runSeed}:${word.id}:spelling`,
      type: "spelling",
      word,
    },
  ]);

  return shuffle(questions, `${runSeed}:questions`);
}

function isKatakanaText(value: string) {
  const kanaChars = Array.from(value).filter((char) => /[\u3040-\u30ffー]/u.test(char));
  if (kanaChars.length === 0) return false;
  return kanaChars.every((char) => /[\u30a0-\u30ffー]/u.test(char));
}

function getSpellingTiles(word: VocabularySummary, seed: string) {
  const target = Array.from(word.kana || getPrimaryJapanese(word)).filter(
    (char) => /[\u3040-\u30ffー]/u.test(char),
  );
  const pool = isKatakanaText(word.kana) ? katakanaPool : hiraganaPool;
  const randomTiles = shuffle(pool, seed).slice(0, Math.max(0, 15 - target.length));

  return shuffle([...target, ...randomTiles].slice(0, 15), `${seed}:tiles`).map(
    (text, index) => ({
      id: `${seed}:tile:${index}:${text}`,
      text,
    }),
  );
}

function JapanesePrompt({ word }: { word: VocabularySummary }) {
  const primary = getPrimaryJapanese(word);
  if (!hasSeparateKana(word)) return <h2>{primary}</h2>;

  return (
    <h2>
      <ruby>
        {primary}
        <rt>{word.kana}</rt>
      </ruby>
    </h2>
  );
}

function FavoriteButton({
  isFavorite,
  onToggle,
  word,
}: {
  isFavorite: boolean;
  onToggle: (wordId: string) => void;
  word: VocabularySummary;
}) {
  return (
    <button
      aria-label={`${isFavorite ? "取消最愛" : "加入最愛"} ${word.kana || getPrimaryJapanese(word)}`}
      aria-pressed={isFavorite}
      className={`favorite-button ${isFavorite ? "active" : ""}`}
      onClick={() => onToggle(word.id)}
      type="button"
    >
      ♥
    </button>
  );
}

function SpeakIconButton({
  label,
  onPlay,
}: {
  label: string;
  onPlay: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="speak-icon-button"
      onClick={onPlay}
      type="button"
    >
      🔊
    </button>
  );
}

function WordRow({
  isFavorite,
  level,
  onFavoriteToggle,
  onPlay,
  word,
}: {
  isFavorite: boolean;
  level: JlptLevel;
  onFavoriteToggle: (wordId: string) => void;
  onPlay: (word: VocabularySummary, level: JlptLevel) => void;
  word: VocabularySummary;
}) {
  return (
    <li className="word-row">
      <FavoriteButton
        isFavorite={isFavorite}
        onToggle={onFavoriteToggle}
        word={word}
      />
      <span>
        <strong>{getPrimaryJapanese(word)}</strong>
        {hasSeparateKana(word) && <small>{word.kana}</small>}
      </span>
      <SpeakIconButton
        label={`播放 ${word.kana || getPrimaryJapanese(word)}`}
        onPlay={() => onPlay(word, level)}
      />
      <em>{word.meanings_zh.slice(0, 2).join("、")}</em>
    </li>
  );
}

function ThemeBackdrop({ className }: { className: string }) {
  return (
    <div className={`theme-backdrop ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function App() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [view, setView] = useState<View>("home");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [selectedSpellingTiles, setSelectedSpellingTiles] = useState<SpellingTile[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(() =>
    loadVolume(voiceVolumeStorageKey, 80),
  );
  const [effectVolume, setEffectVolume] = useState(() =>
    loadVolume(effectVolumeStorageKey, 85),
  );
  const [backgroundVolume, setBackgroundVolume] = useState(() =>
    loadVolume(backgroundVolumeStorageKey, 60),
  );
  const [voice, setVoice] = useState<VoiceId>("voicevox-female");
  const [backgroundMusicId, setBackgroundMusicId] = useState(
    () => localStorage.getItem(backgroundMusicStorageKey) ?? "off",
  );
  const [backgroundTracks, setBackgroundTracks] = useState<BackgroundTrack[]>([]);
  const [theme, setTheme] = useState<ThemeId>("default");
  const [wordLibraryMode, setWordLibraryMode] = useState<WordLibraryMode>("learned");
  const [wordLibraryLevel, setWordLibraryLevel] = useState<JlptLevel>("N5");
  const [learnedWordIds, setLearnedWordIds] = useState<Set<string>>(
    () => loadWordIdSet(learnedStorageKey),
  );
  const [favoriteWordIds, setFavoriteWordIds] = useState<Set<string>>(
    () => loadWordIdSet(favoriteStorageKey),
  );
  const [stageProgressById, setStageProgressById] = useState<
    Record<string, StageProgress>
  >(() => loadStageProgress());
  const [audioDownloadProgress, setAudioDownloadProgress] =
    useState<AudioDownloadProgress | null>(null);
  const [audioDownloadRequest, setAudioDownloadRequest] =
    useState<AudioDownloadRequest | null>(null);
  const [audioCacheMessage, setAudioCacheMessage] = useState("");

  const stages = useMemo(() => getStages(selectedLevel), [selectedLevel]);
  const levelWords = useMemo(() => getLevelWords(selectedLevel), [selectedLevel]);
  const wordLibraryWords = useMemo(() => {
    const wordIds =
      wordLibraryMode === "learned" ? learnedWordIds : favoriteWordIds;
    return getLevelWords(wordLibraryLevel).filter((word) => wordIds.has(word.id));
  }, [favoriteWordIds, learnedWordIds, wordLibraryLevel, wordLibraryMode]);
  const wordLibraryGroups = useMemo(
    () => groupWordsByKanaRow(wordLibraryWords),
    [wordLibraryWords],
  );
  const selectedLevelIndex = jlptLevels.indexOf(selectedLevel) + 1;
  const currentQuestion = questions[questionIndex];
  const activeTheme = getTheme(theme);
  const activeBackgroundTrack = useMemo(
    () =>
      backgroundTracks.find((track) => track.id === backgroundMusicId) ?? null,
    [backgroundMusicId, backgroundTracks],
  );
  const backgroundMusicLabel = activeBackgroundTrack?.name ?? "關閉";

  useEffect(() => {
    const themeClassNames = themes.map((themeOption) => themeOption.className);
    document.body.classList.remove(...themeClassNames);
    document.body.classList.add(activeTheme.className);

    return () => {
      document.body.classList.remove(activeTheme.className);
    };
  }, [activeTheme.className]);

  useEffect(() => {
    saveWordIdSet(learnedStorageKey, learnedWordIds);
  }, [learnedWordIds]);

  useEffect(() => {
    saveWordIdSet(favoriteStorageKey, favoriteWordIds);
  }, [favoriteWordIds]);

  useEffect(() => {
    saveStageProgress(stageProgressById);
  }, [stageProgressById]);

  useEffect(() => {
    void loadBackgroundTracks().then(setBackgroundTracks);
  }, []);

  useEffect(() => {
    localStorage.setItem(backgroundMusicStorageKey, backgroundMusicId);
    setBackgroundMusic(activeBackgroundTrack, backgroundVolume);
  }, [activeBackgroundTrack, backgroundMusicId, backgroundVolume]);

  useEffect(() => {
    localStorage.setItem(voiceVolumeStorageKey, String(voiceVolume));
  }, [voiceVolume]);

  useEffect(() => {
    localStorage.setItem(effectVolumeStorageKey, String(effectVolume));
  }, [effectVolume]);

  useEffect(() => {
    localStorage.setItem(backgroundVolumeStorageKey, String(backgroundVolume));
    setBackgroundMusicVolume(backgroundVolume);
  }, [backgroundVolume]);

  const spellingTiles = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== "spelling") return [];
    return getSpellingTiles(currentQuestion.word, currentQuestion.id);
  }, [currentQuestion]);

  useEffect(() => {
    if (!currentQuestion || !selectedStage || view !== "game") return;
    if (currentQuestion.type === "zh-to-ja") return;

    void playWordAudio(
      currentQuestion.word,
      selectedStage.level,
      voice,
      voiceVolume,
    );
  }, [currentQuestion?.id, selectedStage?.level, view, voice]);

  const ensureAudioDownloaded = async (
    words: VocabularySummary[],
    level: JlptLevel,
    title: string,
    returnView: View,
  ) => {
    if (audioDownloadRequest || audioDownloadProgress) return;

    const selectedVoice = getVoice(voice);
    if (selectedVoice.type !== "audio-pack") return;

    const missingWords = await getMissingAudioWords(words, level, voice);
    if (missingWords.length === 0) return;

    setAudioDownloadRequest({
      level,
      returnView,
      title,
      voiceId: voice,
      voiceName: selectedVoice.name,
      words: missingWords,
    });
    setView("audioDownload");
  };

  const downloadRequestedAudio = async () => {
    if (!audioDownloadRequest) return;
    const { level, returnView, title, voiceId, words } = audioDownloadRequest;

    setAudioDownloadProgress({
      title,
      completed: 0,
      total: words.length,
    });

    try {
      await downloadAudioPack(words, level, voiceId, (completed, total) => {
        setAudioDownloadProgress({ title, completed, total });
      });
    } finally {
      setAudioDownloadProgress(null);
      setAudioDownloadRequest(null);
      setView(returnView);
    }
  };

  const skipAudioDownload = () => {
    if (!audioDownloadRequest) return;
    const { returnView } = audioDownloadRequest;
    setAudioDownloadRequest(null);
    setView(returnView);
  };

  const clearAudioDownloads = () => {
    setAudioCacheMessage("刪除中...");
    void clearDownloadedAudio().then((deleted) => {
      setAudioCacheMessage(
        deleted ? "已刪除下載音檔。" : "目前沒有可刪除的下載音檔。",
      );
    });
  };

  const clearAllCache = () => {
    setAudioCacheMessage("清除全部快取中...");
    void clearAllAppCaches().then(() => {
      [
        learnedStorageKey,
        favoriteStorageKey,
        voiceVolumeStorageKey,
        effectVolumeStorageKey,
        backgroundMusicStorageKey,
        backgroundVolumeStorageKey,
        stageProgressStorageKey,
      ].forEach((key) => window.localStorage.removeItem(key));

      setLearnedWordIds(new Set());
      setFavoriteWordIds(new Set());
      setStageProgressById({});
      setVoiceVolume(80);
      setEffectVolume(85);
      setBackgroundVolume(60);
      setBackgroundMusicId("off");
      setTheme("default");
      setAudioDownloadProgress(null);
      setAudioDownloadRequest(null);
      setSelectedAnswer("");
      setSelectedSpellingTiles([]);
      setIsAnswered(false);
      setAudioCacheMessage("已清除全部快取與本機學習資料。");
    });
  };

  const openLevel = (level: JlptLevel) => {
    setSelectedLevel(level);
    setSelectedStage(null);
    setView("map");
    void ensureAudioDownloaded(getLevelWords(level), level, `JLPT ${level}`, "map");
  };

  const openStage = (stage: Stage) => {
    setSelectedStage(stage);
    setView("preview");
    void ensureAudioDownloaded(
      stage.words,
      stage.level,
      `JLPT ${stage.level} 第 ${stage.number} 關`,
      "preview",
    );
  };

  const openWordLibrary = (mode: WordLibraryMode) => {
    setWordLibraryMode(mode);
    setWordLibraryLevel(selectedLevel);
    setView("wordLevelSelect");
  };

  const openWordLibraryLevel = (level: JlptLevel) => {
    setWordLibraryLevel(level);
    setView("wordList");
  };

  const toggleFavoriteWord = (wordId: string) => {
    setFavoriteWordIds((ids) => {
      const nextIds = new Set(ids);
      if (nextIds.has(wordId)) {
        nextIds.delete(wordId);
      } else {
        nextIds.add(wordId);
      }
      return nextIds;
    });
  };

  const playLibraryWord = (word: VocabularySummary, level: JlptLevel) => {
    void playWordAudio(word, level, voice, voiceVolume);
  };

  const selectBackgroundMusic = (track: BackgroundTrack | null) => {
    setBackgroundMusicId(track?.id ?? "off");
    setBackgroundMusic(track, backgroundVolume);
  };

  const goBack = () => {
    if (view === "game") {
      setView("map");
      return;
    }

    if (view === "preview") {
      setView("map");
      return;
    }

    if (view === "wordList") {
      setView("wordLevelSelect");
      return;
    }

    if (view === "wordLevelSelect") {
      setView("home");
      return;
    }

    if (view === "backgroundMusic") {
      setView("settings");
      return;
    }

    if (view === "help") {
      setView("settings");
      return;
    }

    setView("home");
    setSelectedStage(null);
  };

  const startStage = () => {
    if (!selectedStage) return;

    const runSeed = `${selectedStage.id}:${Date.now()}:${Math.random()}`;
    setQuestions(buildQuestions(selectedStage, levelWords, runSeed));
    setQuestionIndex(0);
    setSelectedAnswer("");
    setSelectedSpellingTiles([]);
    setCorrectCount(0);
    setIsAnswered(false);
    setView("game");
  };

  const answerCurrentQuestion = (answer: string) => {
    if (!currentQuestion || isAnswered) return;

    const normalizedAnswer = answer.trim();
    const correctAnswer =
      currentQuestion.type === "spelling"
        ? currentQuestion.word.kana
        : currentQuestion.word.id;
    const isCorrect =
      currentQuestion.type === "spelling"
        ? normalizedAnswer === correctAnswer
        : normalizedAnswer === correctAnswer;

    setSelectedAnswer(normalizedAnswer);
    setIsAnswered(true);
    playAnswerFeedback(isCorrect ? "correct" : "wrong", effectVolume);
    if (isCorrect) setCorrectCount((count) => count + 1);
  };

  const appendSpellingTile = (tile: SpellingTile) => {
    if (isAnswered) return;
    setSelectedSpellingTiles((tiles) => [...tiles, tile]);
  };

  const removeSpellingTile = (tileId: string) => {
    if (isAnswered) return;
    setSelectedSpellingTiles((tiles) => tiles.filter((tile) => tile.id !== tileId));
  };

  const goNextQuestion = () => {
    if (questionIndex >= questions.length - 1) {
      if (selectedStage) {
        setLearnedWordIds((ids) => {
          const nextIds = new Set(ids);
          selectedStage.words.forEach((word) => nextIds.add(word.id));
          return nextIds;
        });
        setStageProgressById((progressById) => ({
          ...progressById,
          [selectedStage.id]: getNextStageProgress(
            selectedStage,
            progressById[selectedStage.id] ?? getDemoStageProgress(selectedStage),
          ),
        }));
      }
      setView("map");
      setSelectedAnswer("");
      setSelectedSpellingTiles([]);
      setIsAnswered(false);
      return;
    }

    setQuestionIndex((index) => index + 1);
    setSelectedAnswer("");
    setSelectedSpellingTiles([]);
    setIsAnswered(false);
  };

  return (
    <main className={`phone-shell ${activeTheme.className}`}>
      <ThemeBackdrop className={activeTheme.backdropClassName} />
      {view === "home" && (
        <section className="home-screen" aria-labelledby="app-title">
          <div className="home-header">
            <h1 id="app-title">日文單字</h1>
          </div>

          <div className="level-stack" aria-label="JLPT levels">
            {jlptLevels.map((level) => (
              <button
                className={`level-card level-${level.toLowerCase()} ${
                  selectedLevel === level ? "active" : ""
                }`}
                key={level}
                onClick={() => openLevel(level)}
                type="button"
              >
                <span className="level-title">JLPT {level}</span>
                <span className="level-detail">
                  {levelDescriptions[level]} /{" "}
                  {getLevelCount(level).toLocaleString()} 詞
                </span>
              </button>
            ))}
          </div>

          <div className="home-actions">
            <button onClick={() => openWordLibrary("learned")} type="button">
              學過單字
            </button>
            <button onClick={() => openWordLibrary("favorites")} type="button">
              最愛單字
            </button>
          </div>

          <button
            className="settings-entry"
            onClick={() => setView("settings")}
            type="button"
          >
            設定
          </button>
        </section>
      )}

      {view === "wordLevelSelect" && (
        <section className="library-screen" aria-labelledby="library-title">
          <div className="settings-header">
            <button
              aria-label="返回"
              className="back-button dark"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <h2 id="library-title">
              {wordLibraryMode === "learned" ? "學過單字" : "最愛單字"}
            </h2>
            <span />
          </div>

          <div className="library-levels">
            {jlptLevels.map((level) => {
              const activeIds =
                wordLibraryMode === "learned" ? learnedWordIds : favoriteWordIds;
              const count = getLevelWords(level).filter((word) =>
                activeIds.has(word.id),
              ).length;

              return (
                <button
                  className={`level-card level-${level.toLowerCase()}`}
                  key={level}
                  onClick={() => openWordLibraryLevel(level)}
                  type="button"
                >
                  <span className="level-title">JLPT {level}</span>
                  <span className="level-detail">{count.toLocaleString()} 詞</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === "wordList" && (
        <section className="library-screen" aria-labelledby="library-list-title">
          <div className={`map-header level-${wordLibraryLevel.toLowerCase()}-theme`}>
            <button
              aria-label="返回"
              className="back-button"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <div>
              <p className="eyebrow">JLPT {wordLibraryLevel}</p>
              <h2 id="library-list-title">
                {wordLibraryMode === "learned" ? "學過單字" : "最愛單字"}
              </h2>
            </div>
            <span>{wordLibraryWords.length} 詞</span>
          </div>

          <div className="library-list">
            {wordLibraryGroups.length > 0 ? (
              wordLibraryGroups.map((group) => (
                <section className="word-group" key={group.key}>
                  <h3>{group.label}</h3>
                  <ul>
                    {group.words.map((word) => (
                      <WordRow
                        isFavorite={favoriteWordIds.has(word.id)}
                        key={word.id}
                        level={wordLibraryLevel}
                        onFavoriteToggle={toggleFavoriteWord}
                        onPlay={playLibraryWord}
                        word={word}
                      />
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <div className="empty-library">
                {wordLibraryMode === "learned"
                  ? "完成關卡後，單字會出現在這裡。"
                  : "按下單字旁的愛心後，單字會出現在這裡。"}
              </div>
            )}
          </div>
        </section>
      )}

      {view === "map" && (
        <section className="map-screen">
          <div className={`map-header level-${selectedLevel.toLowerCase()}-theme`}>
            <button
              aria-label="返回"
              className="back-button"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <div>
              <p className="eyebrow">Level {selectedLevelIndex}</p>
              <h2>JLPT {selectedLevel}</h2>
            </div>
            <span>{stages.length} 關</span>
          </div>

          <div className="stage-map" aria-label={`${selectedLevel} stage map`}>
            {stages.map((stage) => (
              (() => {
                const status = getStageStatus(stage, stageProgressById);
                return (
                  <button
                    aria-label={`第 ${stage.number} 關 ${
                      status === "unplayed"
                        ? "未玩過"
                        : status === "review-due"
                          ? "需要複習"
                          : status === "review-waiting"
                            ? "不需要複習"
                            : "已經記熟"
                    }`}
                    className={`stage-dot stage-${status}`}
                    key={stage.id}
                    onClick={() => openStage(stage)}
                    type="button"
                  >
                    <span>{stage.number}</span>
                  </button>
                );
              })()
            ))}
          </div>
        </section>
      )}

      {view === "preview" && selectedStage && (
        <section className="preview-screen">
          <div className={`map-header level-${selectedLevel.toLowerCase()}-theme`}>
            <button
              aria-label="返回"
              className="back-button"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <div>
              <p className="eyebrow">{selectedStage.level}</p>
              <h2>第 {selectedStage.number} 關</h2>
            </div>
            <span>10 詞</span>
          </div>

          <div className="stage-sheet" aria-label="Stage preview">
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>單字預覽</h2>
              </div>
              <button onClick={startStage} type="button">
                開始
              </button>
            </div>
            <ul className="word-preview">
              {selectedStage.words.map((word) => (
                <li key={word.id}>
                  <FavoriteButton
                    isFavorite={favoriteWordIds.has(word.id)}
                    onToggle={toggleFavoriteWord}
                    word={word}
                  />
                  <span>
                    <strong>{getPrimaryJapanese(word)}</strong>
                    {hasSeparateKana(word) && <small>{word.kana}</small>}
                  </span>
                  <button
                    aria-label={`播放 ${word.kana || getPrimaryJapanese(word)}`}
                    className="word-audio-button"
                    onClick={() =>
                      void playWordAudio(word, selectedStage.level, voice, voiceVolume)
                    }
                    type="button"
                  >
                    ▶
                  </button>
                  <em>{word.meanings_zh.slice(0, 2).join("、")}</em>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {view === "game" && currentQuestion && selectedStage && (
        <section className="game-screen">
          <div className={`map-header level-${selectedLevel.toLowerCase()}-theme`}>
            <button
              aria-label="返回"
              className="back-button"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <div>
              <p className="eyebrow">第 {selectedStage.number} 關</p>
              <h2>
                {questionIndex + 1} / {questions.length}
              </h2>
            </div>
            <span>{correctCount}</span>
          </div>

          <div className="game-content">
            <div className="question-card">
              <FavoriteButton
                isFavorite={favoriteWordIds.has(currentQuestion.word.id)}
                onToggle={toggleFavoriteWord}
                word={currentQuestion.word}
              />
              <p className="eyebrow">
                {currentQuestion.type === "zh-to-ja" && "看中文選日文"}
                {currentQuestion.type === "ja-to-zh" && "看日文選中文"}
                {currentQuestion.type === "spelling" && "拼字"}
              </p>

              {currentQuestion.type === "zh-to-ja" && (
                <div className="prompt-with-audio">
                  <h2>{currentQuestion.word.meanings_zh.slice(0, 2).join("、")}</h2>
                  <SpeakIconButton
                    label={`播放 ${currentQuestion.word.kana || getPrimaryJapanese(currentQuestion.word)}`}
                    onPlay={() =>
                      void playWordAudio(
                        currentQuestion.word,
                        selectedStage.level,
                        voice,
                        voiceVolume,
                      )
                    }
                  />
                </div>
              )}

              {currentQuestion.type === "ja-to-zh" && (
                <div className="prompt-with-audio">
                  <JapanesePrompt word={currentQuestion.word} />
                  <SpeakIconButton
                    label={`重播 ${currentQuestion.word.kana || getPrimaryJapanese(currentQuestion.word)}`}
                    onPlay={() =>
                      void playWordAudio(
                        currentQuestion.word,
                        selectedStage.level,
                        voice,
                        voiceVolume,
                      )
                    }
                  />
                </div>
              )}

              {currentQuestion.type === "spelling" && (
                <>
                  <div className="prompt-with-audio compact">
                    <strong>
                      {currentQuestion.word.meanings_zh.slice(0, 2).join("、")}
                    </strong>
                    <SpeakIconButton
                      label={`重播 ${currentQuestion.word.kana || getPrimaryJapanese(currentQuestion.word)}`}
                      onPlay={() =>
                        void playWordAudio(
                          currentQuestion.word,
                          selectedStage.level,
                          voice,
                          voiceVolume,
                        )
                      }
                    />
                  </div>
                </>
              )}
            </div>

            {currentQuestion.type !== "spelling" ? (
              <div className="option-list">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option.id;
                  const isCorrect = option.id === currentQuestion.word.id;
                  return (
                    <button
                      className={[
                        isAnswered && isCorrect ? "correct" : "",
                        isAnswered && isSelected && !isCorrect ? "wrong" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={isAnswered}
                      key={option.id}
                      onClick={() => answerCurrentQuestion(option.id)}
                      type="button"
                    >
                      {currentQuestion.type === "zh-to-ja"
                        ? hasSeparateKana(option)
                          ? `${getPrimaryJapanese(option)}（${option.kana}）`
                          : getPrimaryJapanese(option)
                        : option.meanings_zh.slice(0, 2).join("、")}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="spelling-panel">
                <div className="spelling-answer" aria-label="拼字答案">
                  {selectedSpellingTiles.length > 0 ? (
                    selectedSpellingTiles.map((tile) => (
                      <button
                        disabled={isAnswered}
                        key={tile.id}
                        onClick={() => removeSpellingTile(tile.id)}
                        type="button"
                      >
                        {tile.text}
                      </button>
                    ))
                  ) : (
                    <span />
                  )}
                </div>
                <div className="tile-grid">
                  {spellingTiles.map((tile) => {
                    const isUsed = selectedSpellingTiles.some(
                      (selectedTile) => selectedTile.id === tile.id,
                    );
                    return (
                      <button
                        className={isUsed ? "used" : ""}
                        disabled={isAnswered || isUsed}
                        key={tile.id}
                        onClick={() => appendSpellingTile(tile)}
                        type="button"
                      >
                        {tile.text}
                      </button>
                    );
                  })}
                </div>
                <div className="spelling-actions">
                  <button
                    disabled={isAnswered || selectedSpellingTiles.length === 0}
                    onClick={() =>
                      setSelectedSpellingTiles((tiles) => tiles.slice(0, -1))
                    }
                    type="button"
                  >
                    退一格
                  </button>
                  <button
                    disabled={isAnswered || selectedSpellingTiles.length === 0}
                    onClick={() => setSelectedSpellingTiles([])}
                    type="button"
                  >
                    清除
                  </button>
                  <button
                    disabled={isAnswered || selectedSpellingTiles.length === 0}
                    onClick={() =>
                      answerCurrentQuestion(
                        selectedSpellingTiles.map((tile) => tile.text).join(""),
                      )
                    }
                    type="button"
                  >
                    檢查
                  </button>
                </div>
              </div>
            )}

            {isAnswered && (
              <div className="answer-panel">
                <span>
                  {selectedAnswer ===
                  (currentQuestion.type === "spelling"
                    ? currentQuestion.word.kana
                    : currentQuestion.word.id)
                    ? "正確"
                    : "答案"}
                </span>
                <strong>
                  {getPrimaryJapanese(currentQuestion.word)}
                  {hasSeparateKana(currentQuestion.word)
                    ? ` / ${currentQuestion.word.kana}`
                    : ""}
                </strong>
                <em>{currentQuestion.word.meanings_zh.slice(0, 2).join("、")}</em>
                <button onClick={goNextQuestion} type="button">
                  {questionIndex >= questions.length - 1 ? "完成" : "下一題"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {view === "settings" && (
        <section className="settings-screen">
          <div className="settings-header">
            <button
              aria-label="返回"
              className="back-button dark"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <h2>設定</h2>
            <span />
          </div>

          <div className="settings-content">
            <section className="settings-card">
              <h3>音量</h3>
              <label className="range-row">
                <span>語音</span>
                <input
                  max="100"
                  min="0"
                  onChange={(event) => setVoiceVolume(Number(event.target.value))}
                  type="range"
                  value={voiceVolume}
                />
                <strong>{voiceVolume}</strong>
              </label>
              <label className="range-row">
                <span>音效</span>
                <input
                  max="100"
                  min="0"
                  onChange={(event) => setEffectVolume(Number(event.target.value))}
                  type="range"
                  value={effectVolume}
                />
                <strong>{effectVolume}</strong>
              </label>
              <label className="range-row">
                <span>背景</span>
                <input
                  max="100"
                  min="0"
                  onChange={(event) => setBackgroundVolume(Number(event.target.value))}
                  type="range"
                  value={backgroundVolume}
                />
                <strong>{backgroundVolume}</strong>
              </label>
            </section>

            <section className="settings-card">
              <h3>背景音樂</h3>
              <button
                className="settings-nav-button"
                onClick={() => setView("backgroundMusic")}
                type="button"
              >
                <span>
                  <strong>{backgroundMusicLabel}</strong>
                  <small>點擊選擇背景音樂</small>
                </span>
                <em>›</em>
              </button>
            </section>

            <section className="settings-card">
              <h3>幫助</h3>
              <button
                className="settings-nav-button"
                onClick={() => setView("help")}
                type="button"
              >
                <span>
                  <strong>新手教學</strong>
                  <small>了解關卡、複習、音檔與客製化</small>
                </span>
                <em>›</em>
              </button>
            </section>

            <section className="settings-card">
              <h3>配音</h3>
              <div className="choice-grid">
                {voiceOptions.map((voiceOption) => (
                  <button
                    className={voice === voiceOption.id ? "active" : ""}
                    key={voiceOption.id}
                    onClick={() => setVoice(voiceOption.id)}
                    type="button"
                  >
                    {voiceOption.name}
                  </button>
                ))}
              </div>
              <button
                className="settings-action danger"
                onClick={clearAudioDownloads}
                type="button"
              >
                刪除已下載音檔
              </button>
              <button
                className="settings-action danger strong-danger"
                onClick={clearAllCache}
                type="button"
              >
                清除全部快取
              </button>
              {audioCacheMessage && (
                <p className="settings-note">{audioCacheMessage}</p>
              )}
            </section>

            <section className="settings-card">
              <h3>主題</h3>
              <div className="choice-grid">
                {themes.map((themeOption) => (
                  <button
                    className={theme === themeOption.id ? "active" : ""}
                    key={themeOption.id}
                    onClick={() => setTheme(themeOption.id)}
                    type="button"
                  >
                    {themeOption.name}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}

      {view === "help" && (
        <section className="settings-screen">
          <div className="settings-header">
            <button
              aria-label="返回"
              className="back-button dark"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <h2>幫助</h2>
            <span />
          </div>

          <div className="settings-content help-content">
            <section className="settings-card help-card">
              <h3>第一次使用</h3>
              <ol>
                <li>在首頁選擇 JLPT N5 到 N1。</li>
                <li>進入等級後，點選任一關卡查看 10 個單字預覽。</li>
                <li>按下開始後會進入 30 題練習。</li>
                <li>完成後會回到該等級的關卡選擇頁。</li>
              </ol>
            </section>

            <section className="settings-card help-card">
              <h3>題型</h3>
              <ul>
                <li>看中文選日文：根據中文意思選正確日文。</li>
                <li>看日文選中文：題目會顯示日文與振假名。</li>
                <li>拼字：點下方假名方塊組成答案，再按檢查。</li>
              </ul>
            </section>

            <section className="settings-card help-card">
              <h3>語音與音檔</h3>
              <ul>
                <li>拼字題與看日文選中文會自動播放單字語音。</li>
                <li>每個單字旁的小喇叭可手動重播。</li>
                <li>進入等級或關卡時，如果目前配音有未下載音檔，系統會詢問是否下載到本機快取。</li>
                <li>設定頁可切換配音、調整語音音量，也可刪除已下載音檔。</li>
              </ul>
            </section>

            <section className="settings-card help-card">
              <h3>複習狀態</h3>
              <ul>
                <li>白色：未玩過。</li>
                <li>黃色：需要複習。</li>
                <li>綠色：已完成，暫時不需要複習。</li>
                <li>藍色：已完成 5 次複習，視為記熟。</li>
              </ul>
            </section>

            <section className="settings-card help-card">
              <h3>單字收藏</h3>
              <ul>
                <li>在單字預覽、關卡題目、學過單字與最愛單字列表中，都可以按愛心收藏。</li>
                <li>學過單字會在完成關卡後自動加入。</li>
                <li>學過單字與最愛單字會依 N5 到 N1 分頁，再依假名行分組。</li>
              </ul>
            </section>

            <section className="settings-card help-card">
              <h3>主題與背景音樂</h3>
              <ul>
                <li>設定頁可切換預設、抹茶、黑白、深海、漫畫、南極等主題。</li>
                <li>背景音樂頁可選擇音樂或關閉播放。</li>
                <li>開發者可 fork 專案後新增主題、背景動畫、按鈕形狀與自己的音樂。</li>
              </ul>
            </section>
          </div>
        </section>
      )}

      {view === "backgroundMusic" && (
        <section className="settings-screen">
          <div className="settings-header">
            <button
              aria-label="返回"
              className="back-button dark"
              onClick={goBack}
              type="button"
            >
              ‹
            </button>
            <h2>背景音樂</h2>
            <span />
          </div>

          <div className="settings-content">
            <section className="settings-card background-music-card">
              <div>
                <p className="eyebrow">正在播放</p>
                <h3>{backgroundMusicLabel}</h3>
              </div>
              <div
                aria-hidden="true"
                className={`record-player ${
                  activeBackgroundTrack ? "is-playing" : ""
                }`}
              >
                <div className="record-disc">
                  <span />
                </div>
              </div>
            </section>

            <section className="music-list" role="list">
              <button
                className={backgroundMusicId === "off" ? "active" : ""}
                onClick={() => selectBackgroundMusic(null)}
                type="button"
              >
                <span>關閉</span>
                <small>不播放背景音樂</small>
              </button>
              {backgroundTracks.map((track) => (
                <button
                  className={backgroundMusicId === track.id ? "active" : ""}
                  key={track.id}
                  onClick={() => selectBackgroundMusic(track)}
                  type="button"
                >
                  <span>{track.name}</span>
                  <small>{track.mood ?? track.license ?? "背景循環"}</small>
                </button>
              ))}
            </section>
          </div>
        </section>
      )}

      {view === "audioDownload" && audioDownloadRequest && (
        <section className="download-screen">
          <div className={`map-header level-${audioDownloadRequest.level.toLowerCase()}-theme`}>
            <button
              aria-label="稍後再下載"
              className="back-button"
              disabled={Boolean(audioDownloadProgress)}
              onClick={skipAudioDownload}
              type="button"
            >
              ‹
            </button>
            <div>
              <p className="eyebrow">Audio</p>
              <h2>音檔下載</h2>
            </div>
            <span>{audioDownloadRequest.level}</span>
          </div>

          <div className="download-page-panel">
            <p className="eyebrow">{audioDownloadRequest.voiceName}</p>
            <h2>{audioDownloadRequest.title}</h2>
            <p>
              還有 {audioDownloadRequest.words.length.toLocaleString()} 個音檔未下載到本機快取。
            </p>

            {audioDownloadProgress ? (
              <>
                <div className="download-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.round(
                        audioDownloadProgress.total > 0
                          ? (audioDownloadProgress.completed / audioDownloadProgress.total) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
                <em>
                  {audioDownloadProgress.completed.toLocaleString()} /{" "}
                  {audioDownloadProgress.total.toLocaleString()}
                </em>
              </>
            ) : (
              <div className="download-actions">
                <button
                  className="secondary"
                  onClick={skipAudioDownload}
                  type="button"
                >
                  稍後
                </button>
                <button onClick={downloadRequestedAudio} type="button">
                  下載
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;

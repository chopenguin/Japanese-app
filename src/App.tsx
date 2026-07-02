import { useMemo, useState } from "react";
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

const levelDescriptions: Record<JlptLevel, string> = {
  N5: "入門基礎",
  N4: "日常常用",
  N3: "中級銜接",
  N2: "進階理解",
  N1: "高階表達",
};

type View = "home" | "map" | "preview" | "game" | "settings";

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

function buildQuestions(stage: Stage, pool: VocabularySummary[]) {
  const questions = stage.words.flatMap<Question>((word) => [
    {
      id: `${word.id}:zh-to-ja`,
      type: "zh-to-ja",
      word,
      options: buildQuestionOptions(word, pool, `${stage.id}:${word.id}:zh`),
    },
    {
      id: `${word.id}:ja-to-zh`,
      type: "ja-to-zh",
      word,
      options: buildQuestionOptions(word, pool, `${stage.id}:${word.id}:ja`),
    },
    {
      id: `${word.id}:spelling`,
      type: "spelling",
      word,
    },
  ]);

  return shuffle(questions, `${stage.id}:questions`);
}

function speakJapanese(word: VocabularySummary, volume: number) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.kana || getPrimaryJapanese(word));
  utterance.lang = "ja-JP";
  utterance.rate = 0.86;
  utterance.volume = volume / 100;
  window.speechSynthesis.speak(utterance);
}

function App() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [view, setView] = useState<View>("home");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [spellingAnswer, setSpellingAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(80);
  const [effectVolume, setEffectVolume] = useState(60);
  const [voice, setVoice] = useState("default");
  const [theme, setTheme] = useState("classic");

  const stages = useMemo(() => getStages(selectedLevel), [selectedLevel]);
  const levelWords = useMemo(() => getLevelWords(selectedLevel), [selectedLevel]);
  const selectedLevelIndex = jlptLevels.indexOf(selectedLevel) + 1;
  const currentQuestion = questions[questionIndex];

  const openLevel = (level: JlptLevel) => {
    setSelectedLevel(level);
    setSelectedStage(null);
    setView("map");
  };

  const openStage = (stage: Stage) => {
    setSelectedStage(stage);
    setView("preview");
  };

  const goBack = () => {
    if (view === "game") {
      setView("preview");
      return;
    }

    if (view === "preview") {
      setView("map");
      return;
    }

    setView("home");
    setSelectedStage(null);
  };

  const startStage = () => {
    if (!selectedStage) return;

    setQuestions(buildQuestions(selectedStage, levelWords));
    setQuestionIndex(0);
    setSelectedAnswer("");
    setSpellingAnswer("");
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
    if (isCorrect) setCorrectCount((count) => count + 1);
  };

  const goNextQuestion = () => {
    if (questionIndex >= questions.length - 1) {
      setView("preview");
      setSelectedAnswer("");
      setSpellingAnswer("");
      setIsAnswered(false);
      return;
    }

    setQuestionIndex((index) => index + 1);
    setSelectedAnswer("");
    setSpellingAnswer("");
    setIsAnswered(false);
  };

  return (
    <main className="phone-shell">
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
            <button type="button">學過單字</button>
            <button type="button">最愛單字</button>
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
              <button
                className="stage-dot"
                key={stage.id}
                onClick={() => openStage(stage)}
                type="button"
              >
                <span>{stage.number}</span>
              </button>
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
                  <span>
                    <strong>{getPrimaryJapanese(word)}</strong>
                    {hasSeparateKana(word) && <small>{word.kana}</small>}
                  </span>
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
              <p className="eyebrow">
                {currentQuestion.type === "zh-to-ja" && "看中文選日文"}
                {currentQuestion.type === "ja-to-zh" && "看日文選中文"}
                {currentQuestion.type === "spelling" && "拼字"}
              </p>

              {currentQuestion.type === "zh-to-ja" && (
                <h2>{currentQuestion.word.meanings_zh.slice(0, 2).join("、")}</h2>
              )}

              {currentQuestion.type === "ja-to-zh" && (
                <>
                  <h2>{getPrimaryJapanese(currentQuestion.word)}</h2>
                  {hasSeparateKana(currentQuestion.word) && (
                    <small>{currentQuestion.word.kana}</small>
                  )}
                </>
              )}

              {currentQuestion.type === "spelling" && (
                <>
                  <button
                    className="speak-button"
                    onClick={() => speakJapanese(currentQuestion.word, voiceVolume)}
                    type="button"
                  >
                    播放語音
                  </button>
                  <strong>{currentQuestion.word.meanings_zh.slice(0, 2).join("、")}</strong>
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
                        ? getPrimaryJapanese(option)
                        : option.meanings_zh.slice(0, 2).join("、")}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="spelling-box">
                <input
                  autoCapitalize="off"
                  autoCorrect="off"
                  disabled={isAnswered}
                  onChange={(event) => setSpellingAnswer(event.target.value)}
                  placeholder="輸入假名"
                  value={spellingAnswer}
                />
                <button
                  disabled={isAnswered || spellingAnswer.trim().length === 0}
                  onClick={() => answerCurrentQuestion(spellingAnswer)}
                  type="button"
                >
                  檢查
                </button>
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
            </section>

            <section className="settings-card">
              <h3>配音</h3>
              <div className="choice-grid">
                {[
                  ["default", "預設"],
                  ["voice-a", "Voice A"],
                  ["voice-b", "Voice B"],
                ].map(([id, label]) => (
                  <button
                    className={voice === id ? "active" : ""}
                    key={id}
                    onClick={() => setVoice(id)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <h3>主題</h3>
              <div className="choice-grid">
                {[
                  ["classic", "米白"],
                  ["green", "抹茶"],
                  ["mono", "黑白"],
                ].map(([id, label]) => (
                  <button
                    className={theme === id ? "active" : ""}
                    key={id}
                    onClick={() => setTheme(id)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;

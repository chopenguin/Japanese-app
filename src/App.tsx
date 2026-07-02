import { useMemo, useState } from "react";
import {
  getLevelCount,
  getStages,
  jlptLevels,
  type JlptLevel,
  type Stage,
} from "./vocabulary";

const levelDescriptions: Record<JlptLevel, string> = {
  N5: "入門基礎",
  N4: "日常常用",
  N3: "中級銜接",
  N2: "進階理解",
  N1: "高階表達",
};

function App() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);

  const stages = useMemo(() => getStages(selectedLevel), [selectedLevel]);
  const totalWords = getLevelCount(selectedLevel);
  const selectedLevelIndex = jlptLevels.indexOf(selectedLevel) + 1;

  return (
    <main className="phone-shell">
      <section className="home-screen" aria-labelledby="app-title">
        <div className="home-header">
          <p className="eyebrow">Japanese Vocabulary</p>
          <h1 id="app-title">日文單字</h1>
          <p className="home-subtitle">選擇 JLPT 等級，開始一關 10 個單字的練習。</p>
        </div>

        <div className="level-stack" aria-label="JLPT levels">
          {jlptLevels.map((level) => (
            <button
              className={`level-card level-${level.toLowerCase()} ${
                selectedLevel === level ? "active" : ""
              }`}
              key={level}
              onClick={() => {
                setSelectedLevel(level);
                setSelectedStage(null);
              }}
              type="button"
            >
              <span className="level-title">JLPT {level}</span>
              <span className="level-detail">
                {levelDescriptions[level]} / {getLevelCount(level).toLocaleString()} 詞
              </span>
            </button>
          ))}
        </div>

        <div className="home-actions">
          <button type="button">學過單字</button>
          <button type="button">最愛單字</button>
        </div>
      </section>

      <section className="map-screen">
        <div className={`map-header level-${selectedLevel.toLowerCase()}-theme`}>
          <div>
            <p className="eyebrow">Level {selectedLevelIndex}</p>
            <h2>JLPT {selectedLevel}</h2>
          </div>
          <span>{stages.length} 關</span>
        </div>

        <div className="map-summary">
          <span>{totalWords.toLocaleString()} 個單字</span>
          <span>每關 10 詞</span>
          <span>30 題練習</span>
        </div>

        <div className="stage-map" aria-label={`${selectedLevel} stage map`}>
          {stages.map((stage) => (
            <button
              className={`stage-dot ${selectedStage?.id === stage.id ? "active" : ""}`}
              key={stage.id}
              onClick={() => setSelectedStage(stage)}
              type="button"
            >
              <span>{stage.number}</span>
            </button>
          ))}
        </div>

        <aside className="stage-sheet" aria-label="Stage preview">
          {selectedStage ? (
            <>
              <div className="sheet-heading">
                <div>
                  <p className="eyebrow">
                    {selectedStage.level} / 第 {selectedStage.number} 關
                  </p>
                  <h2>單字預覽</h2>
                </div>
                <button type="button">開始</button>
              </div>
              <ul className="word-preview">
                {selectedStage.words.map((word) => (
                  <li key={word.id}>
                    <span>
                      <strong>{word.display}</strong>
                      <small>{word.kana}</small>
                    </span>
                    <em>{word.meanings_zh.slice(0, 2).join("、")}</em>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="empty-sheet">
              <p className="eyebrow">Stage Preview</p>
              <h2>選一個關卡</h2>
              <p>點選上方關卡，可以先確認本關 10 個單字。</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;

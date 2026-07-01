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

  return (
    <main className="app-shell">
      <section className="app-header" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Japanese Vocabulary</p>
          <h1 id="app-title">日文單字練習</h1>
        </div>
        <div className="today-card">
          <span className="today-label">今日複習</span>
          <strong>0</strong>
        </div>
      </section>

      <section className="level-panel" aria-label="JLPT levels">
        {jlptLevels.map((level) => (
          <button
            className={`level-button ${selectedLevel === level ? "active" : ""}`}
            key={level}
            onClick={() => {
              setSelectedLevel(level);
              setSelectedStage(null);
            }}
            type="button"
          >
            <span>{level}</span>
            <small>{levelDescriptions[level]}</small>
            <strong>{getLevelCount(level).toLocaleString()} 詞</strong>
          </button>
        ))}
      </section>

      <section className="content-grid">
        <section className="stage-list" aria-labelledby="stage-list-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{selectedLevel}</p>
              <h2 id="stage-list-title">關卡列表</h2>
            </div>
            <span>
              {stages.length} 關 / {totalWords.toLocaleString()} 詞
            </span>
          </div>

          <div className="stages">
            {stages.map((stage) => (
              <button
                className={`stage-row ${
                  selectedStage?.id === stage.id ? "selected" : ""
                }`}
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                type="button"
              >
                <span className="stage-number">{stage.number}</span>
                <span className="stage-copy">
                  <strong>第 {stage.number} 關</strong>
                  <small>{stage.title}</small>
                </span>
                <span className="stage-meta">10 詞</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="preview-panel" aria-label="Stage preview">
          {selectedStage ? (
            <>
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">
                    {selectedStage.level} / 第 {selectedStage.number} 關
                  </p>
                  <h2>單字預覽</h2>
                </div>
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
            <div className="empty-preview">
              <p className="eyebrow">Preview</p>
              <h2>選一個關卡</h2>
              <p>每關固定 10 個單字，之後會組成 30 題練習。</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;

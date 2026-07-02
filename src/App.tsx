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

type View = "home" | "map" | "preview";

function App() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [view, setView] = useState<View>("home");

  const stages = useMemo(() => getStages(selectedLevel), [selectedLevel]);
  const selectedLevelIndex = jlptLevels.indexOf(selectedLevel) + 1;

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
    if (view === "preview") {
      setView("map");
      return;
    }

    setView("home");
    setSelectedStage(null);
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
          </div>
        </section>
      )}
    </main>
  );
}

export default App;

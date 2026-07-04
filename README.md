# Japanese Vocabulary App

開源、可客製化的 JLPT N5-N1 日文單字學習 app。核心目標是用關卡、複習提醒、語音、主題與背景音樂，做成可以 fork 後改成自己喜歡風格的學習工具。

Open-source and customizable JLPT N5-N1 Japanese vocabulary learning app. It is designed around stages, spaced review, voice packs, themes, and background music so users can fork and adapt it to their own study style.

## 繁體中文

### 功能

- JLPT N5-N1 單字資料。
- 每 10 個單字一關，每關 30 題。
- 題型包含看中文選日文、看日文選中文、拼字。
- 關卡單字會先打亂後分配，不直接照假名順序。
- 關卡狀態包含未玩過、需要複習、不需要複習、已記熟。
- 內建標準女聲與標準男聲音檔。
- 支援瀏覽器語音作為備援。
- 音檔可下載到本機快取。
- 學過單字與最愛單字列表。
- 可切換主題、背景音樂、音量、配音。
- 支援自行新增主題、背景音樂與配音。

### 開發指令

```bash
npm install
npm run dev
npm run build
```

常用腳本：

- `npm run dev`: 啟動本機開發伺服器。
- `npm run build`: TypeScript 檢查與 production build。
- `npm run build:background`: 掃描 `public/background` 並更新背景音樂 manifest。
- `npm run audio:voicevox`: 使用本機 VOICEVOX engine 生成單字語音。

### 程式碼結構

- `src/main.tsx`: React 入口，載入全域樣式與主題樣式。
- `src/App.tsx`: 主要 app UI 與互動邏輯。包含首頁、等級頁、關卡列表、單字預覽、答題、設定、背景音樂、幫助頁、音檔下載頁、學過/最愛單字列表。
- `src/audio.ts`: 語音播放、音效、背景音樂、音檔快取、下載音檔、清除音檔快取。
- `src/vocabulary.ts`: 載入 vocabulary manifest、取得等級單字、建立關卡、日文顯示輔助。
- `src/styles.css`: app 主要版面、手機 UI、卡片、關卡、設定、遊戲畫面樣式。
- `src/themes/index.ts`: 主題列表與主題型別。
- `src/themes/default.ts`: 預設米白主題設定。
- `src/themes/matcha.ts`: 抹茶主題設定。
- `src/themes/mono.ts`: 黑白高對比主題設定。
- `src/themes/ocean.ts`: 深海主題設定。
- `src/themes/manga.ts`: 黑白手繪漫畫主題設定。
- `src/themes/antarctic.ts`: 南極主題設定。
- `src/themes/styles.css`: 所有主題的 CSS 變數、背景動畫與主題差異。
- `data/vocabulary`: 原始單字資料。依 `N5` 到 `N1` 分層，每個單字一個資料夾。
- `data/vocabulary/manifest.json`: 前端載入用的單字索引。
- `data/vocabulary/translation-overrides.zh-TW.json`: 中文意思修正覆蓋表。
- `scripts/build-vocabulary-data.mjs`: 從 `data/vocabulary` 建立前端 vocabulary manifest。
- `scripts/build-background-manifest.mjs`: 從 `public/background` 建立背景音樂清單。
- `scripts/generate-voicevox-audio.mjs`: 呼叫本機 VOICEVOX engine 批次產生 wav 音檔。
- `public/audio/voices`: 語音包。每個 voice id 一個資料夾，內含各 JLPT 等級 wav 與 `manifest.json`。
- `public/background`: 背景音樂資料夾，支援自行放入新的音檔。
- `index.html`: Vite app HTML 入口。
- `vite.config.ts`: Vite 設定。
- `package.json`: npm scripts 與依賴。
- `DATA_SOURCES.md`: 單字資料來源與整理說明。

### 新增主題

1. 在 `src/themes` 新增一個檔案，例如 `sakura.ts`。
2. 匯出符合 `AppTheme` 的物件：

```ts
export const sakuraTheme = {
  id: "sakura",
  name: "櫻花",
  className: "theme-sakura",
  backdropClassName: "theme-backdrop-sakura",
} as const;
```

3. 到 `src/themes/index.ts`：
   - 把 `ThemeId` 加上 `"sakura"`。
   - import `sakuraTheme`。
   - 加入 `themes` 陣列。
4. 到 `src/themes/styles.css` 新增 `.theme-sakura` 的 CSS 變數。
5. 如果需要背景動畫，新增 `.theme-backdrop-sakura span` 相關樣式。

主題可以調整：

- `--page-bg`, `--paper`, `--surface-soft`, `--surface-glass`
- `--text-main`, `--text-soft`, `--muted`
- `--button-dark`, `--button-dark-text`
- `--radius-card`, `--radius-control`
- `--stage-unplayed-bg`, `--stage-due-bg`, `--stage-waiting-bg`, `--stage-mastered-bg`
- 背景圖片、動畫、按鈕形狀、陰影與邊框

### 新增背景音樂

1. 把音檔放進 `public/background`。
2. 建議使用 `.mp3`, `.ogg`, `.wav`, `.m4a`。
3. 執行：

```bash
npm run build:background
```

4. 重新啟動或重新整理 app，設定頁的背景音樂列表會出現新音樂。

注意：如果要公開 repo，請只放可以合法公開散布的音樂。私人 fork 可以放自己的音樂，但仍應遵守來源授權。

### 新增配音

目前內建：

- `browser`: 瀏覽器語音。
- `voicevox-female`: 標準女聲音檔。
- `voicevox-male`: 標準男聲音檔。

新增語音包建議流程：

1. 在 `public/audio/voices` 新增資料夾，例如 `my-voice`。
2. 建立 `manifest.json`，描述 voice id、名稱、來源、授權與 coverage。
3. 依等級建立 `N5`, `N4`, `N3`, `N2`, `N1` 資料夾。
4. 音檔命名要和單字 id 一致，例如 `n5-0001.wav`。
5. 在 `public/audio/voices/index.json` 加入新 voice。
6. 在 `src/audio.ts` 的 `VoiceId` 與 `voiceOptions` 加入新 voice。

VOICEVOX 生成範例：

```bash
npm run audio:voicevox -- --level N5 --all --voice voicevox-male --speaker 21 --text-source kana
```

### GitHub Pages

這是 Vite app。部署到 GitHub Pages 時，建議確認 `vite.config.ts` 的 `base` 是否符合 repo path。若 repo 名稱是 `Japanese-app`，通常 base 需要是 `/Japanese-app/`。

## English

### Features

- JLPT N5-N1 vocabulary data.
- 10 words per stage and 30 questions per stage.
- Question types: Chinese to Japanese, Japanese to Chinese, spelling.
- Stage words are shuffled before being assigned to stages.
- Stage states: unplayed, review due, review waiting, mastered.
- Built-in standard female and standard male voice packs.
- Browser speech fallback.
- Audio files can be downloaded into local cache.
- Learned words and favorite words lists.
- Theme, background music, volume, and voice settings.
- Designed for custom themes, music, and voice packs.

### Development

```bash
npm install
npm run dev
npm run build
```

Scripts:

- `npm run dev`: start the local dev server.
- `npm run build`: run TypeScript checks and production build.
- `npm run build:background`: scan `public/background` and update the background music manifest.
- `npm run audio:voicevox`: generate word audio through a local VOICEVOX engine.

### Code Map

- `src/main.tsx`: React entry point.
- `src/App.tsx`: main UI and app flow, including home, level map, preview, quiz, settings, music picker, help page, audio download page, learned words, and favorites.
- `src/audio.ts`: word audio playback, answer sound effects, background music, audio cache, download flow, and cache cleanup.
- `src/vocabulary.ts`: vocabulary manifest loading, level lookup, stage creation, and Japanese display helpers.
- `src/styles.css`: main app layout and component styles.
- `src/themes/index.ts`: theme registry and theme types.
- `src/themes/*.ts`: theme metadata files.
- `src/themes/styles.css`: theme variables, theme colors, backdrop animations, and theme-specific visuals.
- `data/vocabulary`: source vocabulary database, grouped by JLPT level and word folder.
- `data/vocabulary/manifest.json`: generated vocabulary index used by the app.
- `data/vocabulary/translation-overrides.zh-TW.json`: Traditional Chinese meaning overrides.
- `scripts/build-vocabulary-data.mjs`: builds the vocabulary manifest.
- `scripts/build-background-manifest.mjs`: builds the background music manifest.
- `scripts/generate-voicevox-audio.mjs`: batch-generates wav files through VOICEVOX.
- `public/audio/voices`: voice pack assets and manifests.
- `public/background`: background music assets.
- `index.html`: Vite HTML entry.
- `vite.config.ts`: Vite configuration.
- `package.json`: npm scripts and dependencies.
- `DATA_SOURCES.md`: vocabulary source notes.

### Add A Theme

1. Create a new file under `src/themes`, for example `sakura.ts`.
2. Export an `AppTheme` object.
3. Add the theme id, import, and object to `src/themes/index.ts`.
4. Add `.theme-sakura` variables to `src/themes/styles.css`.
5. Add `.theme-backdrop-sakura span` styles if the theme needs custom background animation.

Themes can customize colors, surfaces, text, buttons, radii, stage status colors, shadows, background images, and backdrop animations.

### Add Background Music

1. Put audio files in `public/background`.
2. Recommended formats: `.mp3`, `.ogg`, `.wav`, `.m4a`.
3. Run:

```bash
npm run build:background
```

4. Refresh the app and choose the new track from Settings > Background Music.

Only commit music that you have permission to redistribute.

### Add A Voice Pack

1. Create a folder under `public/audio/voices`, for example `my-voice`.
2. Add a `manifest.json`.
3. Create `N5`, `N4`, `N3`, `N2`, and `N1` folders.
4. Name audio files by vocabulary id, for example `n5-0001.wav`.
5. Add the pack to `public/audio/voices/index.json`.
6. Add the voice id and option to `src/audio.ts`.

VOICEVOX example:

```bash
npm run audio:voicevox -- --level N5 --all --voice voicevox-male --speaker 21 --text-source kana
```

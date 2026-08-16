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

正式站目前只部署兩套 VOICEVOX 音檔。先前的 `gpt-sovits-custom` 試作沒有納入正式索引，WAV 仍可留在本機備份，日後重做時再建立獨立音色倉庫。

#### 語音包格式

每套檔案型配音都使用一個不含空白的 `voice id`，並依下列結構存放：

```text
public/audio/voices/my-voice/
├─ manifest.json
├─ N5/
│  ├─ n5-0001.wav
│  └─ ...
├─ N4/
├─ N3/
├─ N2/
└─ N1/
```

- 等級資料夾固定使用大寫 `N5`、`N4`、`N3`、`N2`、`N1`。
- WAV 檔名必須與 `data/vocabulary/manifest.json` 裡的單字 `id` 完全一致，例如 `n5-0001.wav`。
- `manifest.json` 至少應記錄 `schema_version`、`id`、`name`、引擎、格式、授權說明與各等級的 `coverage`。
- 每個 word id 只對應一個 WAV；多讀音的處理方式應在生成階段決定。

#### 方法 A：用本專案的 GPT-SoVITS Colab 一鍵產生 N5-N1

專案根目錄的 `GPT-SoVITS-v4-word-TTS-colab.ipynb` 已內嵌目前全部 8,334 筆詞彙及安裝器，不需要另外上傳 `stage.json`、`stages.json` 或 vocabulary manifest。

1. 把筆記本上傳至 Google Colab，將執行階段設為 GPU（建議 T4 以上）。
2. 選擇「執行階段 → 全部執行」。
3. 出現上傳視窗時，選擇一段 3–10 秒、單一說話者、無音樂的參考音。建議直接用正確逐字稿命名，例如 `おはようございます.wav`；否則先在筆記本設定 `PROMPT_TEXT_OVERRIDE`。
4. 筆記本會安裝 GPT-SoVITS、下載模型、先產生試聽，再依序生成 N5-N1。模型及依賴會自動下載，不需掛載 Google Drive。
5. 只有 8,334 個 WAV 全部通過檢查後，瀏覽器才會自動下載 `gpt-sovits-custom-complete-voice-pack.zip`。
6. 將 zip 完整解壓，取出 `public/audio/voices/gpt-sovits-custom` 裡的 `manifest.json`、N5–N1 資料夾與 WAV。
7. 不要再用舊的 `INSTALL-VOICE-PACK.cmd` 把完整音色塞進主 repo；改依 [`docs/VOICE-PACK-REPOSITORIES.md`](docs/VOICE-PACK-REPOSITORIES.md) 建立一個音色一個獨立倉庫。

免費 Colab 可能在 8,334 筆全部完成前回收執行階段。只要仍在同一個執行階段，重跑批次格會跳過已完成且有效的 WAV；執行階段被回收後，因為沒有掛載持久儲存，進度也會消失。

#### 方法 B：加入獨立 GitHub 音色倉庫

主 repo 不再直接加入新的完整 WAV。從 `voice-pack-template` 建立一個全新的獨立 repo，發布其 GitHub Pages 後執行：

```powershell
node scripts/register-remote-voice-pack.mjs `
  --id my-voice `
  --name "我的音色" `
  --base-url "https://chopenguin.github.io/japanese-voice-example"
```

這只會修改很小的 `public/audio/voices/index.json`。設定頁會在執行時讀取索引，不需再修改 `VoiceId` union 或 `voiceOptions`。完整操作、1 GB 限制與 private repo 注意事項請看 [`docs/VOICE-PACK-REPOSITORIES.md`](docs/VOICE-PACK-REPOSITORIES.md)。

#### 大型語音包與 GitHub Pages

目前純 GitHub Pages 部署包含兩套 VOICEVOX，共 16,668 個 WAV、約 502 MB；主程式不再依賴家庭伺服器或 `VITE_VOICE_PACK_BASE_URL`。

完整 GPT-SoVITS 音色約 692 MB，和兩套內建音色放在同一網站會超過 GitHub Pages 的 1 GB 上限。因此日後每個新音色使用一個獨立 GitHub repo 與 Pages 站點，主 repo 只保存一筆包含 `audio_base_url` 的索引。`vite.config.ts` 只把未設定 `audio_base_url` 的內建音色複製到主站，忽略本機未註冊的實驗音檔。

建立獨立音色倉庫時請使用 `voice-pack-template`，不要 fork 主專案。詳細步驟請看 [`docs/VOICE-PACK-REPOSITORIES.md`](docs/VOICE-PACK-REPOSITORIES.md)。

Private repo 不代表 Pages 音檔是私人的，也不會自動解決授權問題。公開網頁不能安全地內嵌 GitHub token；真正需要限制存取的音色應保留為私人備份或日後用本機匯入功能處理。

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

The production site currently includes only the two VOICEVOX packs. Together
they contain 16,668 WAV files and occupy about 502 MB, so the app can remain a
GitHub-only deployment without the home server.

Each file-based voice uses a URL-safe voice id and this layout:

```text
public/audio/voices/my-voice/
├─ manifest.json
├─ N5/n5-0001.wav
├─ N4/...
├─ N3/...
├─ N2/...
└─ N1/...
```

Folder names must use uppercase JLPT levels, while every WAV filename must exactly match a word id in `data/vocabulary/manifest.json`.

To generate the complete custom GPT-SoVITS pack:

1. Open `GPT-SoVITS-v4-word-TTS-colab.ipynb` in a GPU-enabled Google Colab runtime.
2. Select Runtime > Run all and upload a clean 3–10 second reference clip when prompted. Name the clip after its exact Japanese transcript or set `PROMPT_TEXT_OVERRIDE` in the notebook.
3. No `stage.json`, `stages.json`, vocabulary upload, or Google Drive mount is required. The notebook contains all 8,334 N5-N1 entries and downloads its dependencies and models automatically.
4. The final zip downloads only after all 8,334 WAV files pass validation.
5. Extract the zip and copy its `manifest.json` plus N5-N1 directories into a
   new repository based on `voice-pack-template`. The old
   `INSTALL-VOICE-PACK.cmd` workflow should not be used for the production app.

The complete experimental GPT-SoVITS pack is about 692 MB. Combining it with
the two built-in packs would exceed GitHub Pages' 1 GB published-site limit.
Future voices therefore use one standalone GitHub repository and Pages site per
pack. Register a published pack with one small catalog edit:

```powershell
node scripts/register-remote-voice-pack.mjs `
  --id my-voice `
  --name "My voice" `
  --base-url "https://chopenguin.github.io/japanese-voice-example"
```

The app loads that catalog at runtime, so no TypeScript union needs editing.
See [docs/VOICE-PACK-REPOSITORIES.md](docs/VOICE-PACK-REPOSITORIES.md) for the
repository template, path contract, validation, GitHub Pages limits, and the
important restrictions on private repositories. A private source repository
does not automatically make its Pages deployment private, and repository
visibility does not replace the required voice, model, and redistribution
rights.

VOICEVOX example:

```bash
npm run audio:voicevox -- --level N5 --all --voice voicevox-male --speaker 21 --text-source kana
```

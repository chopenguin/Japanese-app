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
- `gpt-sovits-custom`: GPT-SoVITS 自訂音色。

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
6. 將 zip 放在本專案資料夾或其他方便的位置並完整解壓；不要直接在壓縮檔內執行安裝器。
7. 雙擊解壓目錄根層的 `INSTALL-VOICE-PACK.cmd`。

安裝器會再次核對 8,334 個檔案，然後：

- 複製語音包至 `public/audio/voices/gpt-sovits-custom`。
- 更新 `public/audio/voices/index.json`。
- 更新 `src/audio.ts` 的 `VoiceId` 與 `voiceOptions`。

視窗最後顯示 `Voice pack installation completed.` 且停在 `Press any key to continue...`，才代表安裝成功。如果專案已搬到其他位置，可在解壓目錄開啟 PowerShell 後指定路徑：

```powershell
.\install-gpt-sovits-voice-pack.ps1 -ProjectRoot "D:\path\to\Japanese"
```

免費 Colab 可能在 8,334 筆全部完成前回收執行階段。只要仍在同一個執行階段，重跑批次格會跳過已完成且有效的 WAV；執行階段被回收後，因為沒有掛載持久儲存，進度也會消失。

#### 方法 B：手動加入其他語音包

1. 在 `public/audio/voices` 新增資料夾，例如 `my-voice`。
2. 建立 `manifest.json`，描述 voice id、名稱、引擎、格式、授權與 coverage。
3. 建立 `N5` 至 `N1` 資料夾，並放入以 word id 命名的 WAV。
4. 在 `public/audio/voices/index.json` 的 `voices` 陣列加入新語音及 manifest 路徑。
5. 在 `src/audio.ts` 的 `VoiceId` union 與 `voiceOptions` 加入相同 id。
6. 執行 `npm run build`，再以 `npm run dev` 實際切換新配音並抽查每個等級。

新增前後請保持三處 id 完全相同：資料夾名稱、`public/audio/voices/index.json`、`src/audio.ts`。缺檔或讀取失敗時，app 會改用瀏覽器日文語音，因此驗收時不要只確認「有聲音」，也要確認播放的確實是新音色。

#### 大型語音包與 GitHub Pages

完整 GPT-SoVITS 語音包約 660 MB；和現有兩套 VOICEVOX 一起部署會使網站超過 GitHub Pages 的 1 GB 上限。本專案因此採用以下分工：

- GitHub Pages：程式、語音索引、manifest，不含 WAV。
- 家用伺服器的 `japanese-voice-download` Docker：所有 `voices/<voice-id>/<N級>/<word-id>.wav`。
- 本機開發：未設定遠端網址時，仍可直接讀取 `public/audio/voices` 裡的本機 WAV。

Pages 建置必須提供 `VITE_VOICE_PACK_BASE_URL`。`vite.config.ts` 會在建置時排除所有語音 WAV，但保留 `public/audio/voices/index.json` 與各語音的 manifest。

#### 部署到家用伺服器

目前部署目錄是 Windows 的 `S:\docker\japanese-voice-download`，在主機上對應 `/home/jimmy/docker/japanese-voice-download`。Docker 設定放在 `server/voice-download`，Caddy 以唯讀方式提供檔案並支援 CORS、Range request 與長效 WAV 快取。

目前正式語音網址：

```text
https://japanese-voice-download.tailb5ba7a.ts.net/voices
```

GitHub Actions repository variable 已設定為：

```text
VOICE_PACK_BASE_URL=https://japanese-voice-download.tailb5ba7a.ts.net/voices
```

##### 日常更新操作

如果只新增或重做語音，先在專案根目錄用 PowerShell 增量同步。此命令只新增或更新，不會刪除主機上多出的檔案：

```powershell
robocopy .\public\audio\voices S:\docker\japanese-voice-download\voices /E /Z /J /R:3 /W:3 /MT:16
```

如果修改了 Docker 或 Caddy 設定，再把三個部署檔同步到 S 槽：

```powershell
Copy-Item -LiteralPath `
  .\server\voice-download\Caddyfile, `
  .\server\voice-download\compose.yaml, `
  .\server\voice-download\README.md `
  -Destination S:\docker\japanese-voice-download -Force
```

接著登入主機，驗證設定、更新映像並套用：

```bash
ssh home
cd /home/jimmy/docker/japanese-voice-download
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker exec japanese-voice-tunnel tailscale funnel status
```

部署由兩個受限容器組成：唯讀 Caddy 與無特權 userspace Tailscale sidecar。兩者共用容器網路命名空間，不發布任何主機 TCP port；Tailscale Funnel 只把容器內的 `http://127.0.0.1:8080` 轉成公開 HTTPS。

- Caddy：最多 0.5 CPU、192 MB RAM、64 PID。
- Tailscale：最多 0.25 CPU、192 MB RAM、64 PID。
- 兩者皆為唯讀 root filesystem、禁止提權、限制 tmpfs 與日誌大小。
- Tailscale 使用 userspace networking，不掛載 Docker socket、`/dev/net/tun` 或其他主機裝置，也不取得 Linux capabilities。

##### 啟用、停用與檢查公開網址

正常重啟後 Funnel 設定會保留。若 `funnel status` 顯示尚未啟用，可執行：

```bash
docker exec japanese-voice-tunnel tailscale funnel --yes --bg http://127.0.0.1:8080
```

暫時停止公開下載，但保留容器與 Tailscale 身分：

```bash
docker exec japanese-voice-tunnel tailscale funnel --https=443 off
```

停止兩個容器可執行 `docker compose down`；再次啟動使用 `docker compose up -d`。不要隨意執行 `docker compose down -v`，因為 `-v` 會刪除保存 sidecar 身分的 `tailscale-state` volume，之後必須重新 Connect device。

##### 驗證與故障排查

從 Windows 外網驗證索引與 WAV Range request：

```powershell
curl.exe --fail --head https://japanese-voice-download.tailb5ba7a.ts.net/voices/index.json
curl.exe --fail --range 0-99 -o NUL https://japanese-voice-download.tailb5ba7a.ts.net/voices/gpt-sovits-custom/N5/n5-0001.wav
```

在主機查看健康狀態、日誌與即時資源使用：

```bash
docker compose ps
docker compose logs --tail=100
docker stats japanese-voice-download japanese-voice-tunnel --no-stream
docker exec japanese-voice-tunnel tailscale status
docker exec japanese-voice-tunnel tailscale funnel status
```

若 `tailscale status` 顯示 `Logged out`，查看 `docker compose logs voice-tunnel` 提供的登入網址，登入後按 **Connect device**，再重新啟用 Funnel。不要把登入網址、auth key 或 `tailscale-state` volume 內容提交到 Git。

`VOICE_PACK_BASE_URL` 是公開資源網址，不是 API secret。Pages workflow 會把它傳給 Vite；如果沒有設定，建置會直接失敗，避免部署出沒有語音的網站。

如需在本機測試遠端語音，在不進 Git 的 `.env.local` 加入：

```dotenv
VITE_VOICE_PACK_BASE_URL=https://japanese-voice-download.tailb5ba7a.ts.net/voices
```

此時開發伺服器、預載、整包下載與 Cache Storage 都會使用遠端 URL。刪除 `.env.local` 後則恢復讀取本機 WAV。若日後改用 Cloudflare R2，仍可使用 `scripts/upload-voice-packs-to-r2.ps1` 與 `scripts/r2-cors.json`。

壓縮包與解壓來源可在完成以下檢查並另有備份後刪除：`npm run build` 成功、設定頁能選到新配音、N5-N1 各抽查至少一個單字確實使用新音色。

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
5. Extract the zip and double-click `INSTALL-VOICE-PACK.cmd`. Do not run the installer from inside the zip.
6. Installation is complete only when the window shows `Voice pack installation completed.`

The installer copies the pack to `public/audio/voices/gpt-sovits-custom` and registers it in both `public/audio/voices/index.json` and `src/audio.ts`. If the project cannot be detected automatically, run:

```powershell
.\install-gpt-sovits-voice-pack.ps1 -ProjectRoot "D:\path\to\Japanese"
```

To add another pack manually:

1. Create its folder, JLPT subfolders, WAV files, and `manifest.json` under `public/audio/voices`.
2. Add the same id to `public/audio/voices/index.json`, the `VoiceId` union, and `voiceOptions` in `src/audio.ts`.
3. Run `npm run build`, then use `npm run dev` to test the new voice at every JLPT level. A missing pack file silently falls back to browser speech, so verify that the selected voice is actually being played.

The complete custom GPT-SoVITS pack is about 660 MB. Together with the two existing VOICEVOX packs, it would push the published site over GitHub Pages' 1 GB limit. The project therefore keeps code, indexes, and manifests on GitHub Pages while serving every WAV from a dedicated home-server container.

Voice files use this path pattern:

```text
voices/<voice-id>/<JLPT-level>/<word-id>.wav
```

The current deployment uses `server/voice-download` on `/home/jimmy/docker/japanese-voice-download` (`S:\docker\japanese-voice-download` from Windows). Sync `public/audio/voices` into its `voices` directory, then run `docker compose up -d` through `ssh home`. The Caddy container is read-only and supports CORS and Range requests. The production base URL is `https://japanese-voice-download.tailb5ba7a.ts.net/voices`.

The deployment uses a read-only Caddy container and an unprivileged userspace Tailscale sidecar. They share a container network namespace and publish no host TCP ports. Tailscale Funnel exposes only the in-container `http://127.0.0.1:8080` service over public HTTPS. Add the resulting public `/voices` URL as the GitHub Actions repository variable `VOICE_PACK_BASE_URL`.

The Pages workflow passes that value to `VITE_VOICE_PACK_BASE_URL`. Pages builds fail when it is missing and exclude all voice WAV files from `dist`. For local remote-server testing, copy `.env.example` to `.env.local`. Without that variable, local development continues to use WAV files under `public/audio/voices`. Cloudflare R2 remains an optional alternative through `scripts/upload-voice-packs-to-r2.ps1`.

For the full server runbook—including sync, updates, resource limits, Funnel enable/disable, verification, and login recovery—see [server/voice-download/README.md](server/voice-download/README.md).

VOICEVOX example:

```bash
npm run audio:voicevox -- --level N5 --all --voice voicevox-male --speaker 21 --text-source kana
```

# 每個音色一個 GitHub 倉庫

主程式只內建 `voicevox-female` 與 `voicevox-male`。兩套合計 16,668 個 WAV、約 502 MB，低於 GitHub Pages 的 1 GB 發布站點上限。不滿意的 `gpt-sovits-custom` 保留在本機但不再部署。

## 為什麼使用模板而不是 fork

GitHub 模板產生的倉庫只有一個新的初始 commit，不會繼承主專案歷史，而且建立時可以自行選擇 public 或 private。Fork 會繼承上游歷史與可見性關係，不適合獨立管理每個大型音色。

將 `voice-pack-template` 複製成一個新的獨立倉庫，每個倉庫只存一套音色：

```text
manifest.json
N5/*.wav
N4/*.wav
N3/*.wav
N2/*.wav
N1/*.wav
```

不要在同一個倉庫反覆提交多套完整重製檔。Git 即使刪除舊檔仍會保留歷史，倉庫大小仍會增加。完全重製大型音色時，建立新的獨立倉庫通常更乾淨。

## 建立與發布

1. 複製 `voice-pack-template` 到新的空資料夾。
2. 將 `manifest.example.json` 改名為 `manifest.json`，填入 id、名稱、來源及授權說明。
3. 放入 N5–N1 WAV；檔名必須等於 vocabulary word id。
4. 執行 `node scripts/build-site.mjs . _site`。它會檢查 coverage、缺檔、RIFF/WAVE 檔頭與 1 GB 上限。
5. 建立全新 GitHub repo、推送，並在 Settings > Pages 選擇 GitHub Actions。
6. 記下 Pages 根網址，例如 `https://chopenguin.github.io/japanese-voice-example`。

## 在主程式註冊

回到 Japanese app 根目錄執行：

```powershell
node scripts/register-remote-voice-pack.mjs `
  --id my-voice `
  --name "我的音色" `
  --base-url "https://chopenguin.github.io/japanese-voice-example"
```

此命令只會在 `public/audio/voices/index.json` 增加一筆很小的索引，不會把外部 WAV 加進主 repo。重新部署主程式後，設定頁會自動讀取索引並顯示新音色，不需再修改 TypeScript union。

外部 repo 的網址契約固定為：

```text
<audio_base_url>/<N級>/<word-id>.wav
```

## Private repo 的限制

- Private repo 可以隱藏原始 Git 歷史，但一般 GitHub Pages 部署可能仍公開在網路上。
- 真正只有授權成員可開啟的私人 Pages，需要組織使用 GitHub Enterprise Cloud 的 Pages 存取控制。
- 公開靜態網頁不能安全地內嵌 personal access token；把 token 寫入 Vite、JavaScript、Actions artifact 或索引都等同公開。
- 如果音檔必須保持私人，請把 private repo 當成備份或手動下載來源，不要把它註冊為公開網頁音色。日後應另做「使用者登入後下載」或「本機匯入音色包」功能。
- 設為 private 只限制可見性，不會自動解決聲音、模型、角色或參考素材的授權問題。

GitHub 官方參考：

- [Creating a repository from a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Changing the visibility of your GitHub Pages site](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)

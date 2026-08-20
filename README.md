# 宇多田光｜歌曲版本分組 Review 表

純靜態 GitHub Pages 網站，俾 fans 逐行查看歌曲版本，剔選希望由目前歌曲組拆出的 mix、remaster、live 或其他版本，再複製或匯出結果。

## 今版功能

- Excel／table 式排列，一行一個歌曲組或收錄版本。
- 顯示每個版本第一次收錄時的演唱名義，例如 `宇多田ヒカル`、`Utada`、`Hikaru Utada` 及合作名義。
- 有多個收錄名稱的歌曲組，其非組名版本設有 checkbox，可標記「建議拆出」。只有一個收錄名稱的組不會製造冇意義的拆分選項。
- 「複製選擇」會產生方便貼入 message／討論區的文字。
- 「匯出 JSON」會下載結構化拆分建議。
- 可搜尋歌名、版本名稱及演唱名義，亦可只查看有可拆版本或已選項目。

## 放上 GitHub Pages

1. 將呢個 folder 入面所有檔案放到 GitHub repository 根目錄；`index.html` 必須位於根目錄。
2. 去 repository 的 **Settings → Pages**。
3. 在 **Build and deployment** 將 Source 設為 **Deploy from a branch**。
4. 選擇 `main` branch、`/(root)` folder，然後 Save。

官方說明：[Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 資料檔案

```text
data/utada-hikaru-quiz-pool.base.json   歌曲組及目前同組版本
data/utada-hikaru-releases.raw.json     演唱名義及首次收錄資料
```

網站用完整收錄名稱將兩份資料配對。要拆組或合組，主要修改 `utada-hikaru-quiz-pool.base.json` 的 `title` 與 `includes`；演唱名義會由 raw release JSON 自動帶入。

## 本機預覽

因為網站需要 `fetch()` JSON，唔好直接 double-click `index.html`。在網站 folder 內執行：

```bash
python3 -m http.server 8000
```

然後開 <http://localhost:8000>。

## 可選檢查

網站本身不需要 Node.js。交付前可以執行：

```bash
npm run build
```

檢查會確認 JavaScript syntax、歌曲分組、重複名稱，以及每個收錄版本都有演唱名義。

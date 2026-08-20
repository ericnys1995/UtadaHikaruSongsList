# Hikaru Utada Song Version Showroom

一個純靜態、可以直接放上 GitHub Pages 的歌曲版本分組 showroom。

用途係俾 fans 逐組 review：目前放埋一齊嘅版本，應該繼續同組，定係要拆開。呢一版**唔包含 quiz、排名算法、投票 backend 或 login**。

## 直接放上 GitHub Pages

1. 在 GitHub 建立一個 repository。
2. 將呢個 folder **入面所有檔案**放到 repository 根目錄；`index.html` 必須位於根目錄。
3. 去 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 將 Source 設為 **Deploy from a branch**。
5. 選擇 `main` branch、`/(root)` folder，然後 Save。

官方說明：[Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

呢個 project 已包含 `.nojekyll`，GitHub Pages 會直接當一般 HTML／CSS／JS 靜態網站處理。

## 本機預覽

因為 JavaScript 要 `fetch()` JSON，唔好直接 double-click `index.html`。在呢個 folder 內開 terminal：

```bash
python3 -m http.server 8000
```

然後開 <http://localhost:8000>。

## 點樣改分組

所有 showroom 資料只來自：

```text
data/utada-hikaru-quiz-pool.base.json
```

每組只需要兩項：

```json
{
  "title": "Song A",
  "includes": [
    "Song A",
    "Song A -Version Name-"
  ]
}
```

- `title`：卡片顯示的組名。
- `includes`：目前暫定放在同一組的完整收錄名稱。
- 要拆組：將部分名稱移到另一個 `{ "title", "includes" }` object。
- 要合組：將名稱放入同一個 `includes`，再刪除空出來的組。
- 不需要手動加 ID、年份、評分或 quiz 規則。

改完 JSON 後重新 push，showroom 會自動跟住新資料顯示。歌曲卡的「複製此組連結」使用組名做網址定位，所以只要組名不變，重新排序都唔會令連結失效。

## 檔案結構

```text
index.html                         頁面結構及文字
styles.css                        視覺、responsive layout
app.js                            讀取 JSON、搜尋、篩選、排序、分享
data/utada-hikaru-quiz-pool.base.json
.nojekyll                         停用 GitHub Pages 的 Jekyll 處理
```

## 可選：資料及程式檢查

網站本身不需要 Node.js；以下只係交付前檢查：

```bash
npm run build
```

檢查會確認 JavaScript syntax、JSON schema、重複組名及統計數字。

---

Unofficial fan discussion tool. Not affiliated with Hikaru Utada or the record labels.

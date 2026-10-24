# 阿軒 AI 工作站

可放在 GitHub Pages 的靜態公開外殼；私人 Google Drive 中繼資料須在使用者登入並授權後才讀取。正式執行零 npm 相依套件；HTML、CSS 與原生 JavaScript ES modules，不需要建置程序。

## 隱私邊界

- 公開原始碼不包含任何真實根資料夾 ID、用戶端 ID、文件清單、報告名稱、帳戶信箱、權杖或資料快照。測試識別碼全部是 synthetic。
- 初次開啟自動顯示設定視窗。只將公開 Web OAuth `clientId` 與私人範圍設定 `rootId` 存入**目前瀏覽器**的 localStorage。資料夾 ID 本身仍應視為私人設定；請勿分享瀏覽器設定或提交至 Git。
- access token、帳戶資訊、檔名、路徑及時間只留在 JavaScript 記憶體，不寫入 localStorage、sessionStorage、網址或日誌，不送到自建伺服器。Google 官方 GIS 仍依 Google 的服務及 Cookie 規則運作。
- OAuth popup token model，只請求 `https://www.googleapis.com/auth/drive.metadata.readonly`；不讀取文件內文、不下載檔案、不呼叫修改 API。Google 授權範圍本身可讀取帳戶可存取的中繼資料，**不是資料夾層級 OAuth 權限**；本程式在前端額外限制只列出選定根資料夾後代。
- 先確認授權，再用 `about.get` 讀取目前帳戶顯示名稱與電子郵件。按「即時重新整理」才開始讀取根資料夾與子項目。所有 API fetch 使用 GET、no-store、omit credentials、20 秒逾時。
- 登出此頁、設定儲存、pagehide、授權到期或錯誤時，清除私人渲染與記憶體，取消請求並使過期回應失效。**不呼叫 revoke**，不撤銷使用者在其他頁面的整體 Google 授權。
- 不含 analytics、外部字型、service worker、私人快取、後端、Google secrets 或 GitHub Actions。
- GitHub Pages 是公開的；私人安全性依賴 Google 授權、前端約束與本機瀏覽器安全。同一 GitHub Pages origin 的其他程式或瀏覽器擴充功能可能讀取 localStorage；不要在共用／不受信任裝置保留設定。

## 探索與計數

左側分類依根目錄實際子資料夾名稱排序，不虛構八個名稱或補假資料；一般情況若根目錄有八個主資料夾，即顯示八類。根目錄直接放置的檔案另列「根目錄檔案」。分類計數包含後代檔案，Markdown `.md` 備份另列、不視為獨立研究成果。Google 文件與其他檔案也分開計數。捷徑列為其他檔案，不追蹤目標；子資料夾數不含根目錄。

可搜尋名稱／完整相對路徑、篩選分類、選擇是否包含備份、查看近期檔案或展開樹狀地圖。連結僅依驗證的 ID 組成官方 Drive 網址，設定 noopener noreferrer。伺服器名稱只以 textContent 渲染。清單顯示最新 100 筆，樹狀圖可查看已掃描且符合篩選的所有項目。

上限：10,000 檔案、1,000 子資料夾、500 個列表分頁；每頁最多 1,000 項。達上限或 Google 回傳 incompleteSearch 時明確標示「未完整」，不將部分數量當成總量。掃描使用者可存取且未移至垃圾桶的後代；Google 權限未開放項目本來就不可見。狀態區顯示範圍、掃描完整性及快照時間。沒有排程，資料不會自行更新。

## 本機執行與測試

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# 瀏覽 http://127.0.0.1:8765；OAuth 本機來源需另列入 Console。
npm test
node --check app.js
node --check core.js
```

單元測試使用 Node 內建 node:test，無 npm 安裝步驟。`tests/app.test.js` 透過 `tests/browser-helper.mjs` 啟動**全新隔離 Chrome profile**與短暫本機伺服器，在真實 DOM 測試實際 app.js；僅 GIS 與 Google 網路回應使用合成替身，不模擬 DOM。預設偵測 macOS Chrome 與常見 Linux Chromium 路徑，也可用 `CHROME_PATH` 指定瀏覽器執行檔；缺少瀏覽器時整合測試會明確 skip，純 Node 核心與外殼測試仍執行。profile 僅建立於專案 `.browser-profile/`，測試結束會刪除當次 profile。

額外的獨立瀏覽器 smoke script 見 `tests/browser-smoke.mjs`，需本機隔離 Chrome CDP（9224）與靜態伺服器（8765）；執行 `node tests/browser-smoke.mjs` 可檢查 390px／1440px、設定對話框與未登入零 Drive 請求。只使用合成設定，結束即清除。這些都不是實際 Google OAuth 驗證；不使用真實帳密與 Drive 資料。

需支援 dialog、ES modules、AbortSignal.any／timeout 的現代 Chrome、Safari 或 Firefox。不支援 file:// 直接開啟。首次部署與 Google 設定見 [SETUP.md](./SETUP.md)。尚未實際登入驗證：沒有提供 Web 用戶端 ID，也未使用任何真實私人資料。登入後的實機驗收仍由擁有者完成。

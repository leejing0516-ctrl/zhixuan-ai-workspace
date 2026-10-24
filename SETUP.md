# 設定與驗收

## 1. Google Cloud Console

1. 在自己的 Google Cloud 專案啟用 **Google Drive API**。
2. 設定 Google Auth platform／OAuth 同意畫面與受眾。個人 Google 帳戶通常選 External；若維持 Testing，請在 Console 的測試使用者名單加入自己的 Google 電子郵件。**不要把電子郵件提交到此專案。** 可用性、驗證與配額仍依 Console 當時顯示的政策；此專案不保證免驗證。
3. 建立 OAuth 2.0 用戶端，應用程式類型選 **Web application／網頁應用程式**。已有的 Desktop／桌面應用程式用戶端不可沿用到瀏覽器。
4. Authorized JavaScript origins 加入精確來源：

   ```text
   https://leejing0516-ctrl.github.io
   ```

   **不要加入 `/zhixuan-ai-workspace/` 路徑**。來源是 scheme + host + 可選 port。若需本機測試，另加入實際本機來源（Google 對 localhost／loopback 有其規則），與瀏覽器開啟位置完全一致。
5. 本頁採 GIS `oauth2.initTokenClient` popup token flow，不是 redirect authorization-code flow，**不需要設定 redirect URI**。
6. 僅使用公開 Client ID。**不要將 client_secret 複製到前端或 Git，不要在聊天傳送帳密或權杖。**

參考 Google 官方文件：
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/drive/api/reference/rest/v3/files/list
- https://developers.google.com/drive/api/reference/rest/v3/about/get

## 2. 公開外殼與 Pages

此專案以 `leejing0516-ctrl/zhixuan-ai-workspace` 的 repository root 提供 GitHub Pages；公開儲存庫只放經審查的介面與合成測試，不放私人設定或資料。網站網址：

```text
https://leejing0516-ctrl.github.io/zhixuan-ai-workspace/
```

不需要 GitHub Actions，不要設定任何 Google secret。保留 `.nojekyll`。所有相對載入路徑支援 repository subpath。部署前檢查 `git diff` 與檔案列表，勿加入瀏覽器 profile、測試快照、設定或私有資料。CSP meta 已只開放本機資源與必要 Google GIS／API 端點；GitHub Pages 無法單靠 meta 設定所有 HTTP 安全標頭（例如 frame-ancestors／COOP），如需更強的網站隔離請另採支援標頭的主機。

## 3. 只在自己的瀏覽器設定

1. 初次開啟會自動顯示可操作的設定對話框。
2. 貼上 **Web 用戶端的公開 ID**，以及私人根資料夾 ID 或官方 `https://drive.google.com/drive/folders/…` 網址（也接受 `/drive/u/0/folders/…`）。僅接受嚴格格式；不接受任意主機、捷徑網址、檔案網址或片段。
3. 儲存後仍未登入；按 Google 登入，選擇帳戶並給予 metadata readonly 授權。
4. 顯示帳戶後，再按「即時重新整理」。根項目必須是實際資料夾；無權存取或不是資料夾會安全失敗並清除私人畫面。
5. 不要公開分享根資料夾以求讓首頁讀到資料。本頁不需要公開 Drive 分享，也不會變更分享權限。
6. 更換設定會先登出與清除舊資料；「清除此機設定」移除本機兩項設定。若瀏覽器禁用 localStorage，設定會顯示錯誤，不會假裝成功。

附帶 resourcekey 的網址可被解析，但本版本只保留 folder ID；需 resourcekey 才能存取的共享資源不保證可讀取。建議選擇自己擁有或已正式授予存取權的私人資料夾。網址格式無法辨識 OAuth 用戶端實際類型，Desktop ID 即使格式合法仍會被 Google 拒絕，需回 Console 確認 Web 類型。

## 4. 擁有者實機驗收（待執行）

- 未登入：所有數字為 em dash，無檔名／路徑／帳戶／假資料。
- 設定視窗可由鍵盤操作；錯誤 ID 不儲存；取消不讀取資料；缺設定登入只開設定。
- Console 正確 Web origin；popup 正常；取消／拒絕授權不會發送 Drive 請求。
- 真實帳戶僅列出選定根範圍；跨頁、子資料夾、捷徑不外跳、備份分離、搜尋與樹狀圖符合實際內容。
- 空資料夾、無權限、非資料夾、網路中斷、token 到期／401、不完整掃描均有不同且誠實的狀態。
- 讀取途中登出或儲存新設定，延遲回應不得重新顯示舊私人內容。
- DevTools Application 只出現本機設定兩欄，沒有 token 或中繼資料；Network 只讀 Google metadata endpoint，沒有文件內容 API。
- 390px 手機寬度不橫向溢出；按鈕與鍵盤焦點可見；登入後長中文名稱與深層樹狀圖仍可操作。

不要把含真實資料的驗收畫面、Network HAR 或報告提交到公開 repository。

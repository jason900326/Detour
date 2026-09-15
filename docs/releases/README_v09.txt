DETOUR v0.9 — MICRO MISSION LOOP

這一版刻意暫停「附近景點 / POI 推薦」，先驗證 DETOUR 的核心節奏：
時間不是搜尋半徑，而是任務數量。

安裝方式：
1. 解壓縮到 C:\Users\jason\detour
2. 允許覆蓋 src\app\index.tsx 與 src\app\_layout.tsx
3. 新增 src\lib\micro-mission-engine.ts
4. 不需要安裝新的 npm 套件

主要變更：
- 15 / 30 / 60 / 90+ 分鐘分別變成 5 / 7 / 10 / 12 個 micro missions
- CAMERA 模式加入 Color Walk thread
- 自動依 GPS + 日期 + 太陽高度判定 DAY / TWILIGHT / NIGHT
- NIGHT 任務加入公開、照明、人行空間限制
- 任務改成「動詞 + 目標 + 限制 + 完成條件」
- 完成任務後先進 DONE 畫面，750ms 後才出現「下一個任務」按鈕
- 不會先 render 下一個任務，因此修掉下一頁閃現問題
- 室內測試模式不需要模擬距離，可直接測任務節奏
- Passport 保留，室內模式會產生模擬 trace

這一版還沒有：
- 內建相機
- Postcard
- Scene Engine / 壁畫 / 公共藝術資料源

這些等 micro mission 的節奏確認好，再一步一步接。

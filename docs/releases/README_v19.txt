DETOUR v0.19 — CORE LOOP HARDENING

這版只補三個核心洞，不加新玩法。

1. SCENE QUALITY GATE
- 普通、沒有任何辨識度的匿名階梯 / 人行橋 / 步行街段，
  不再有資格當最終目的地。
- 匿名 historic 也會被擋掉。
- Food 一定要是有名字的 food / market Scene。
- 壁畫、街頭藝術、公共藝術仍可無名，因為視覺物件本身就是身份。
- 加入 quality score：image / Wikimedia / Wikipedia / Wikidata /
  artist / heritage / name 等會提高 Scene 品質。
- Engine Review 不再插進 Indoor Test；直接測完整產品流程。

2. NAVIGATION RELIABILITY
- 箭頭改成沿著目前真實 polyline 看前方約 18m，
  不再只用直線指向 Beat 終點。
- Beat 剩餘距離改成沿路線計算，不是直線距離。
- 真實模式若連續 3 次 GPS 顯示離整條 route 超過 45m，
  DETOUR 會自動從目前位置重新計算到同一 Scene 的步行路線。
- Reroute 會保留已完成的 Side Quest，不會從任務 01 重來。
- 只有 rerouting / reroute fail 時才顯示狀態，不增加平常 UI 雜訊。

3. PASSPORT / POSTCARD
每一趟新紀錄開始保存：
- 真正目的地
- 規劃的 walking route
- 實際 GPS trace
- 開始時間 / 結束時間 / 實際花多久
- reroute 次數
- 任務 DONE / SKIPPED
- 照片

Postcard 地圖會同時畫：
灰線 = PLANNED
橘線 = ACTUAL
終點 = Scene marker

舊紀錄沒有這些欄位時仍可正常打開，只會顯示舊資料。

注意：
這仍是 prototype。公開 OSM / routing 資料不等於現場安全保證，
實地仍應遵守道路、封路、私人土地與現場標示。

不需要新 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

DETOUR v0.16 — MAIN QUEST NAVIGATION

這版建立 Main Quest Navigator 的完整骨架。

現在有：
- 每趟路被拆成多個短 Navigation Beat。
- 顯示的距離只代表「下一個 Beat」，不是最終目的地。
- iPhone 朝向會驅動箭頭；轉動手機可以測試方向。
- Beat 有直走 / 左前 / 右前 / 左轉 / 右轉 / Final Beat。
- Side Quest 綁在特定 Beat 上，而不是走到百分比就硬跳出。
- 「查看下一段」只顯示現在到下一個 Beat，不直接公開整條路。
- 室內模式可以一小段一小段模擬前進。
- navigation engine 已拆到 src/lib/navigation-engine.ts。

重要：
現在的 route 是 synthetic prototype route。
它沒有檢查道路、牆、河、私人土地，所以正式模式仍然鎖住。
請不要照這版的箭頭真的出門走。

下一階段 Scene Engine / pedestrian routing 會把真正的可步行 polyline
餵進這套 Navigator；UI 和 Beat 邏輯不用再重做。

不需要新增 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議重啟：
Ctrl + C
npx expo start -c

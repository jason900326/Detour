DETOUR v0.24.1 — MOOD SCREEN FIX

修正：
- 移除「選一個大方向就好。目的地、主線和任務都先不用想。」
- 所有 Mood 卡片整體往上
- Mood 卡片高度稍微收緊
- 中間內容改成 ScrollView
- 「印製這趟 DETOUR 車票 →」固定在底部，不會再被內容推到螢幕外

真正原因：
v0.24 的 CTA 本來存在，但小尺寸畫面上被五張 Mood 卡片擠出 viewport，
所以選完 Mood 後看起來像沒有下一步。

現在不管選哪個 Mood，CTA 都會留在底部並立刻啟用。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c

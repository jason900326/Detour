DETOUR v0.26.1 — QUEST PULSE SURFACE FIX

修正：
SIDE QUEST FOUND / FINAL NODE 出現時，
背景不再比導航頁更黑。

原因：
Main Quest 使用 INK = #0F0F0D。
v0.26 的 Quest Pulse 又蓋了 rgba(5,5,5,0.94)，
視覺上會變成接近 #050505，
所以像突然跳進另一個 modal。

現在：
Quest Pulse 直接使用和 Main Quest 完全相同的 INK 背景。

效果：
- 導航 -> SIDE QUEST FOUND 不會再有背景變暗的跳動
- 只有橘色節點 / 文字出現
- 看起來像同一個導航世界裡突然發生事件
- Side Quest / Final Node 邏輯完全不變

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c

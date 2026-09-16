DETOUR v0.18 — SCENE REVIEW

這版不擴使用者功能，只做 Engine 評估閉環。

只有 INDOOR TEST 會出現 ENGINE REVIEW。

流程：
真實 Scene + 真實步行 route 算好
→ ENGINE REVIEW
→ 看 Engine pick
→ 給回饋
→ 就去這裡 / 無聊換下一個
→ 才進 Main Quest

可回饋：
- 想去
- 普通
- 太熟
- 現在不想去
- 「無聊，換下一個」會自動記 boring

回饋會存進 iPhone 本機 AsyncStorage，並影響之後 Scene score：
interesting +24
okay +2
boring -34
familiar -52
wrong-now -22

ENGINE REVIEW 也會顯示：
- Scene 類型
- 真實步行距離
- Engine score
- DAY / TWILIGHT / NIGHT
- 主要 ranking signals

正式模式完全跳過 review，不會破壞 DETOUR 的神秘感。

不需要新增 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

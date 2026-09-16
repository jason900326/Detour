DETOUR v0.31 — AI DIRECTOR

AI 已經接通。這版開始改善真正的體驗品質。

AI SCENE EDITOR
- specific identity > generic category
- named / richly tagged Scene 優先
- generic square / park / pedestrian / green-space 降權
- visited Scene 明確降權
- distance 是預算，不是最近就最好
- Mood 有不同選景 taste
- Night 不允許 AI 自己腦補「有燈」

AI MISSION DIRECTOR
每個 Side Quest 有：
- mission family
- route phase
- approximate target meters

Route phase：
- WARMUP：第一題超容易成功
- DISCOVER：開始注意具體模式
- SHIFT：換一種方式看同一條街
- ANTICIPATE：抵達前建立懸念但不暴雷

Mission families：
count / contrast / scale / texture / sound /
movement / framing / boundary / pattern / perspective

同一趟 family 不重複。

LOCAL REPETITION MEMORY
App 本機記住最近 30 個 AI Side Quests。
下一趟把最近 18 個 code / family / title 給 AI，
避免一直出同一種任務。

QUALITY GATE
AI 回來後 App 再檢查：
- code 重複
- title 重複
- family 重複
- required photo > 1
- Side Quest 洩漏隱藏目的地名稱
- 太空泛句型

不過 gate 就自動 fallback 到 deterministic mission engine。

ARRIVAL
- 使用真實 Scene metadata
- 任務必須讓這個 Scene 值得停
- 不寫旅遊導覽文
- Food 不要求購買 / 點餐 / 進店

Supabase detour-ai Edge Function 需要部署這版 backend。

安裝：
覆蓋 C:\Users\jason\detour

Ctrl + C
npx expo start -c

DETOUR v0.30 — AI ENGINE BRIDGE

這版先完成 AI 銜接，不部署 Supabase。

目前 App 的完整決策鏈：

1. GPS / OpenStreetMap
   找到附近真實 Scene candidates

2. AI SCENE RANKING（backend 有設定時）
   AI 只在真實 candidates 裡重新排序
   不允許 AI 自己幻想一個不存在的目的地

3. Walking Routing
   真實步行路線仍由 routing engine 計算
   AI 不負責導航 / 距離

4. AI MISSION GENERATION（backend 有設定時）
   根據：
   - Mood
   - DAY / TWILIGHT / NIGHT
   - 時間
   - 真實 Scene metadata
   - 真實 walking distance
   生成 Side Quests + Arrival Mission

5. FALLBACK
   AI endpoint 沒設定、timeout、格式錯誤、server error：
   自動退回原本 deterministic Engine
   旅程不會壞掉。

PRIVACY
傳給 AI 的 Scene 資料不包含：
- GPS 座標
- 使用者 route trace
- 照片
只送候選 Scene 的 OSM metadata、類型、距離和 Engine 評分。

API KEY
OpenAI API key 絕對不放 Expo App。
src/lib/ai-engine.ts 只呼叫自己的 backend URL。

之後 Supabase Ready 時：
1. 部署 backend/detour-ai/index.ts 為 Edge Function
2. 在 Edge Function secret 設：
   OPENAI_API_KEY
3. 可選：
   OPENAI_MODEL=gpt-5.6-luna
4. App 根目錄建立 .env：
   EXPO_PUBLIC_DETOUR_AI_URL=https://<project>.supabase.co/functions/v1/detour-ai
5. 重開：
   npx expo start -c

SETTINGS
新增 AI ENGINE：
- BACKEND CONFIGURED / NOT CONNECTED
- LAST RUN AI / FALLBACK

PLAYTEST
報告新增：
AI-assisted completed

SERVER TEMPLATE
backend/detour-ai/index.ts 已包含：
- Responses API
- Structured Outputs JSON Schema
- rank-scenes
- generate-missions
- DETOUR safety / product prompt rules

目前沒有 Supabase，所以這版跑起來會顯示：
BACKEND · NOT CONNECTED
LAST RUN · FALLBACK

這是預期行為；功能仍全部可用。
等 backend URL 補上，不需要再重寫 App Engine。

安裝：
解壓到
C:\Users\jason\detour
覆蓋 src、backend、.env.example

重開：
Ctrl + C
npx expo start -c

沒有新增 npm 套件。

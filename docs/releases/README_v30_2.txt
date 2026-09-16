DETOUR v0.30.2 — AI LIVE CHECK

Supabase detour-ai Edge Function 已 ACTIVE。
這版新增真正的端到端 AI 測試。

Settings > AI ENGINE > 測試 AI 連線

它不是單純檢查 URL 或 secret：
會真的送兩個 synthetic Scene candidates 到 production detour-ai：

Expo App
→ Supabase Edge Function
→ OpenAI Responses API
→ Structured Output ranking
→ App

成功代表：
- Supabase publishable key 正常
- Edge Function 可呼叫
- OPENAI_API_KEY 正常
- OpenAI model 可用
- Responses API 可用
- JSON Schema Structured Output 可用

失敗時 Alert 會顯示 HTTP status / backend error，
方便直接知道是 key、quota、model 或 Function 問題。

另外：
LAST RUN 初始改成 NOT RUN YET，
不再在 AI 尚未跑過時顯示假狀態。

正式旅程仍維持：
OSM candidates
→ AI ranking
→ walking route
→ AI Side Quests + Arrival Mission
→ fallback on failure

安裝：
解壓覆蓋 C:\Users\jason\detour

Ctrl + C
npx expo start -c

然後：
Settings
→ AI ENGINE
→ 測試 AI 連線

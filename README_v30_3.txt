DETOUR v0.30.3 — AI CLIENT CONFIG FIX

修正：
Settings 顯示 BACKEND · NOT CONNECTED，
原因是 Expo 測試環境沒有讀到 .env 裡的兩個 EXPO_PUBLIC 變數。

這版不再把 AI 連線是否可用綁死在 .env。

App 內建兩個 frontend-safe fallback：
- Detour Supabase Edge Function URL
- Supabase publishable key

這兩個值不是 secret，本來就會出現在 mobile client / browser request。
真正敏感的 OPENAI_API_KEY 仍然只存在 Supabase Edge Function Secrets。

環境變數仍然保留：
未來如果要切 staging / production，可以用 .env 覆蓋預設值。

安裝：
解壓覆蓋 C:\Users\jason\detour

然後：
Ctrl + C
npx expo start -c

進：
Settings
→ AI ENGINE

現在 BACKEND 應該顯示：
CONFIGURED

再按：
測試 AI 連線

這一顆會真正跑：
App
→ Supabase Edge Function
→ OpenAI Responses API
→ Structured Output Scene ranking
→ App

如果下一步仍失敗，Alert 會直接顯示 HTTP / OpenAI backend error，
就能繼續定位 OpenAI key、model 或 quota，而不是再卡在前端設定。

注意：
不要把 OPENAI_API_KEY 放進 App、.env 或 EXPO_PUBLIC_*。

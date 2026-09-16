DETOUR v0.30.1 — SUPABASE AI ENDPOINT CONNECTED

完成：
- Detour Supabase project created
- detour-ai Edge Function deployed
- App endpoint connected
- App sends Supabase publishable key in `apikey` header
- Edge Function validates publishable key before serving requests
- AI failure still falls back to deterministic Engine

Project:
https://ldlhzyfubjbuumikrkuv.supabase.co

Edge Function:
https://ldlhzyfubjbuumikrkuv.supabase.co/functions/v1/detour-ai

IMPORTANT
OpenAI API key is NOT included in the app and NOT included in this zip.

Before AI can actually answer, add this Supabase Edge Function secret:
OPENAI_API_KEY=<your OpenAI API key>

Optional:
OPENAI_MODEL=gpt-5.6-luna

After the secret is set, no App code change is required.

APP ENV
The included `.env` contains only frontend-safe values:
- Supabase function URL
- Supabase publishable key

Never put OPENAI_API_KEY in `.env` because EXPO_PUBLIC_* variables are bundled into the mobile client.

DATABASE
`public.playtest_runs` has also been initialized for later centralized playtest telemetry.
RLS is enabled and client roles have no direct table permissions.
For now the App still keeps playtest telemetry locally until the sync endpoint is added.

INSTALL
Extract/overwrite into:
C:\Users\jason\detour

Then:
Ctrl + C
npx expo start -c

No new npm packages.

DETOUR v0.32 — PLAYTEST READY

這版是朋友外出測試前的必要補強。

1. AUTOMATIC CLOUD TELEMETRY
每個 Playtest run 的狀態會自動匿名同步到 Detour Supabase：
- ready
- started
- completed
- abandoned
- ticket failed
- reroute
- AI / fallback
- mission completion
- selected minutes / mood / scene kind

不需要朋友手動分享報告。

仍不會上傳：
- GPS coordinates
- route trace
- destination / business / park name
- photos
- name / email / account identity

本機資料仍保留，所以網路中斷時不會丟紀錄。
App 下次開啟也會重新同步本機 runs。

Settings > PLAYTEST DATA：
- CLOUD SYNC · ON
- app version
- 立即同步測試資料
- 原本分享文字報告仍保留當 backup

2. ONE-TAP EXPERIENCE RATING
Finish 新增：
「這趟值得嗎？」

三個選項：
- 會再玩
- 還行
- 不值得

評分非強制，不會擋住回首頁。

選「不值得」才會展開：
- 終點普通
- 任務無聊
- 走太久
- 導航難懂
- 做起來尷尬
- 其他

可複選，點下去直接匿名同步，不需要 Submit。

3. VERSION TRACKING
每個 cloud run 會記：
app_version = 0.32.0

之後可以比較不同 build 的：
- completion rate
- reroute rate
- replay rating
- scene kind
- AI / fallback
而不會把不同版本混在一起。

4. DISCLOSURE
Onboarding 明確告訴 tester：
測試版會匿名回傳完成率與簡短評分，
但不包含 GPS、路線、照片或目的地名稱。

BACKEND
Supabase 已部署：
detour-playtest v1 / ACTIVE

Database playtest_runs 已增加：
- app_version
- run_rating
- run_feedback_reasons

RLS 保持啟用。
anon / authenticated 無直接 table 權限。
寫入只經 Edge Function server-side secret key。

Supabase current docs recommend server-side secret keys for admin operations
and keep publishable keys safe for clients.

安裝：
覆蓋 C:\Users\jason\detour

Ctrl + C
npx expo start -c

測試：
Settings
→ PLAYTEST DATA
→ 立即同步測試資料

如果目前 0 runs，先用 Indoor Test 跑一小趟再按同步。

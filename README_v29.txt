DETOUR v0.29 — PLAYTEST TELEMETRY

目的：
把 Engine / Scene 品質交給真實使用者測試，用數據判斷，不再靠 Engine Review。

本機匿名記錄：
- Ticket attempt / success / failure
- 是否開始
- 完成 / 中途離開
- Mood / 時間
- Scene 類型
- planned distance
- actual duration
- Side Quest 完成 / 跳過
- Arrival 完成 / 跳過
- Recovery / reroute 次數與原因
- photo count
- Indoor Test 與 Real-world 分開

不記錄：
- GPS 座標
- route trace
- Scene / 店家 / 公園名稱
- 照片內容
- 姓名 / 帳號

SETTINGS > PLAYTEST DATA：
- 匿名 Tester ID
- REAL / INDOOR run 數量
- 分享測試報告
- 清除測試統計

報告自動整理：
- Ticket success rate
- Completion rate
- Abandon rate
- Reroute rate
- Side Quest completion rate
- Average duration / planned walk
- Recovery reason counts
- By Scene type
- By Mood
- By selected time

第一輪不用 Supabase。
朋友測完從 Settings 分享文字報告給你即可。
多份報告之後可交給 ChatGPT 合併分析。

安裝：
解壓到 C:\Users\jason\detour
覆蓋 src

重開：
Ctrl + C
npx expo start -c

不需要新增 npm 套件。

DETOUR v0.22 — ONBOARDING + SETTINGS + FIRST RUN

這版把目前的核心功能正式包成一個「第一次打開就看得懂」的 App。

FIRST RUN
首次啟動只做 3 頁：
01 THE PROMISE
- 你只選空檔與心情
- DETOUR 決定方向、Scene 與路上發生什麼
- 不是景點清單

02 HIDDEN DESTINATION
- 終點先藏起來
- 主線只顯示下一小段
- 看不懂時點箭頭才看那一小段地圖

03 YOU CAN CHANGE IT
- 店沒開、進不去、不值得，都能換終點
- 已完成任務不消失
- 定位只在按「開始繞路」後才要求

Onboarding 完成後會寫進 AsyncStorage，之後不會每次出現。
Settings 可以手動重播導覽。

SETTINGS
首頁右下新增 SETTINGS，不干擾主畫面。

1. 步行節奏
RELAXED / 慢一點
- Scene ideal/max distance 約縮短 20%
- Routing 上限也同步縮短

NORMAL / 一般
- 現在的 DETOUR 基準

BRISK / 快一點
- Scene / Routing 距離約增加 15%

這不是只有 UI：
Walking Pace 會真的影響 Scene 距離 scoring 與 routing distance limit。

2. 室內測試
- 原本隱藏的長按 DETOUR 仍可用
- Settings 現在也可明確切換
- 狀態會持久保存

3. First Run
- 可重新播放 onboarding
- 不會清空 Passport

4. Data
- 顯示目前 Passport 筆數
- 可清除測試 Passport

PRIVACY / LOCATION
App 開啟時不主動要求定位。
只有按下「開始繞路」後，才要求 foreground location。

儲存
Preferences:
@detour/preferences/v1

Passport:
@detour/passport/v1

不需要新增 npm 套件。

安裝
解壓到：
C:\Users\jason\detour

覆蓋 src。

建議完整重啟：
Ctrl + C
npx expo start -c

第一次跑 v0.22：
因為舊版本沒有 preferences key，所以會看到 onboarding。
完成一次後，下次會直接進首頁。

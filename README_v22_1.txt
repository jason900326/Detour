DETOUR v0.22.1 — VISUAL HIERARCHY PASS

這版不改功能，只處理「精簡變成空洞」的問題。

核心改動：

ONBOARDING
- 內容不再垂直置中漂在大空白裡
- 主內容整體往上
- 說明字 15 -> 18
- line-height 25 -> 29
- 小註解變成有分隔線的 secondary statement
- CTA 放大

SETTINGS
- 所有 note 從 10px 提升到 13px
- action title / choice label 放大
- section label 加粗
- 行高提高
- 每個設定項目更有資訊密度

HOME
- kicker 變成真正可讀的副標
- 大標稍微縮小
- signal dot / 空白縮短
- 底部說明提高可讀性

MOOD
- mood label / code 放大

MAIN QUEST
- hint 從像 debug 小字改成可讀 secondary copy

SIDE QUEST
- 任務說明 15 -> 17
- 完成條件 12 -> 14
- 完成條件加分隔線，讓它不是腳註

ARRIVAL
- 任務說明 14 -> 17
- 完成條件 12 -> 14
- 提高對比和結構

設計原則：
「精簡」不是把內容縮小和推到底部。
DETOUR 應該是：
大標題有情緒
說明有存在感
輔助資訊次要但仍可讀
留白用來建立節奏，不是拿來填滿螢幕

不需要新增 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

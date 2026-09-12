DETOUR v0.22.2 — TOP-RIGHT UTILITY CLUSTER

這版只整理首頁功能入口。

設計決定：
不使用彩色 emoji。
emoji 在不同 iOS / 字型版本會有不同外觀，也會破壞 DETOUR
目前偏 editorial / map / camera 的視覺語言。

首頁右上改成：

[ ◎ PASSPORT / 03 SAVED ] [ ••• ]

PASSPORT
- 46px 高的明確按鈕
- ◎ 當作 stamp / archive 的符號
- 顯示 Passport 數量
- 比原本 9px PASSPORT 小連結更像真正功能

SETTINGS
- 46 x 46 明確觸控區
- 使用 •••，不是小字 SETTINGS
- 右上角固定、容易找到
- 不跟內容搶視覺

首頁底部：
- SETTINGS 完全移除
- 只保留步行節奏
- INDOOR TEST 開啟時才顯示狀態

目標：
首頁主要內容仍然是「你現在有多少時間」。
Passport / Settings 是固定 utility，而不是混在主內容裡。

不需要新增 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

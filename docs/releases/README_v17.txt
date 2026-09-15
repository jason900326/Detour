DETOUR v0.17 — REAL SCENE + REAL WALKING ROUTE

第一次接上真實世界：

- 取得目前位置
- 自動 DAY / TWILIGHT / NIGHT
- OpenStreetMap / Overpass 找真實 Scene
- Mood + 情境 + 距離 + Passport 去過紀錄排序
- OSRM foot profile 計算真實步行路線
- 真實 polyline 切成短 Navigation Beats
- Side Quest 插在真實路線上
- 到達才揭露 Scene 名稱
- 終點 Mission 依 Scene 類型生成
- Passport 保存真正目的地

Scene 候選：
壁畫、街頭藝術、公共藝術、歷史痕跡、市場、食物目的地、
廣場、噴泉、街頭書櫃、視野點、階梯、人行橋、步行街段、老樹。

刻意不把公園、小廟、里民中心當主要候選。

距離：
搜尋半徑固定約 900m，不會因時間一直變大。
步行主線上限約：
15m 430m / 30m 540m / 60m 670m / 90+ 790m。
更多時間主要換成內容，不是一直叫你走更遠。

Night：
會排除多數階梯、人行橋、視野點、老樹、歷史點，
除非 OSM 標記 lit=yes。
Food mood 只選 food / market。

Indoor Test：
一樣查「真實 Scene + 真實步行路線」，
只是用模擬按鈕沿著真實 route 前進。

不需要新 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

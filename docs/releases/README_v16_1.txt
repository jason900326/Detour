DETOUR v0.16.1 — MAIN QUEST UI CLEANUP

這版不新增功能，只清理 Main Quest 畫面。

拿掉：
- PHONE / ROUTE debug 角度
- BEAT 1/7
- Main Quest 進度條
- 大條「查看下一段」
- SIDE QUESTS 計數區
- Destination Hidden / Beat 文案
- 大型 Indoor Test panel

保留：
- 方向箭頭
- 下一個節點距離
- 一句行動指示
- 一句輕提示
- 右下相機
- 縮小後的 Indoor Test 控制

地圖 fallback：
主畫面不再有「查看下一段」按鈕。
如果真的看不懂方向，點中間箭頭本身即可打開下一小段地圖。
它是救援功能，不是主流程。

重要：
route 仍然是 synthetic prototype route，只供室內測試。
不要照這版箭頭真的出門。

不需要新 npm 套件。

解壓縮到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

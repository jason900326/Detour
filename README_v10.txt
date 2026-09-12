DETOUR v0.10 — JOURNEY SPINE + CAMERA

這版只驗證兩件事：
1. 主線終點重新成為旅程骨架，micro missions 只在路上穿插。
2. CAMERA 模式真的打開內建相機，拍完要「留下這張」才算完成任務。

安裝：
  npx expo install expo-camera

然後把 src 覆蓋到：
  C:\Users\jason\detour\src

測試建議：
1. 長按首頁左上 DETOUR，開啟 INDOOR TEST。
2. 先測 15 MIN + CAMERA + 任一顏色。
3. READY 後開始室內主線。
4. 每次按「模擬往前走」，主線距離會下降。
5. 到 milestone 時會插入 SIDE QUEST。
6. Photo side quest 會開 DETOUR CAMERA。
7. 拍照 -> 預覽 -> 重拍 / 留下這張。
8. 留下後直接回主線，不再出現「先停一下」。
9. 到主線終點後還要完成 ARRIVAL 任務。
10. 完成頁會先顯示這趟 session 拍的照片。

注意：
- v0.10 仍不是戶外導航版。真實 Scene / route 還沒接回來。
- 正常模式目前會阻擋開始，避免把亂算座標假裝成真實目的地。
- 這版相片由 expo-camera 儲存在暫存 cache；完成頁能看到，但尚未永久寫入 Passport。Postcard / 永久相片會是下一步。
- DAY / TWILIGHT / NIGHT 仍由 GPS + 日期 + 太陽高度自動判斷。

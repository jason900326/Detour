DETOUR v0.25.3 — SYSTEM THEME CONTRAST PASS

這版重點不是擴功能，是把黑色系統主題下被吃掉的細節救回來。

修正：

1. 首頁 / Mood / 完成頁改成跟著 iOS 系統深淺色
- 系統 Dark Mode：首頁、心情頁、完成頁使用深色底
- 系統 Light Mode：維持原本淺色體驗
- StatusBar 也會跟著系統 / 畫面一起切換

2. 黑色模式下的可讀性補強
- 小標、輔助文字、細線、框線、Badge、小圖示全部提高對比
- Mood 卡片的 icon、說明、編號、底部小字不再被黑底吃掉
- 完成頁的 summary / metadata / ticket 細節不再糊成一片

3. CTA 保留明顯層級
- 首頁開始按鈕
- Mood 頁印製車票按鈕
- 完成頁回首頁按鈕
在 Dark Mode 下都維持可見與可點

注意：
- 如果你首頁右下還看到 INDOOR TEST，代表你在 Settings 裡仍然有開啟測試模式；
  這不再是左上角長按造成的隱藏切換。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c

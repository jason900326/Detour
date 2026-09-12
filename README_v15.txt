DETOUR v0.15 — FILM ROLL

核心變更
- 相機仍保留 live preview。
- 拍照後不再出現「留下這張 / 重拍」。
- 按快門即視為曝光：照片直接收進這趟 DETOUR，也存進 iPhone「照片」，然後回到旅程。
- 相機顯示 ROLL 編號與曝光數。
- 指定拍照任務：成功曝光後才完成並推進。
- 非拍照任務：右下相機只負責留紀錄，拍完不會偷偷把任務完成。
- Journey 主畫面會顯示這卷底片目前用了幾格。
- 完成 DETOUR 後先進短暫 DEVELOPING，再一次看到照片。
- Postcard 會保存並顯示 FILM ROLL 資訊。

暫定底片格數
15 min = 6
30 min = 8
60 min = 12
90+ = 16

目前是 soft limit（創作提示），不是硬鎖。
就算拍超過，也不會卡住指定拍照任務。

安裝
如果 v0.14.x 已經正常，不需要新增 npm 套件。

解壓縮到：
C:\Users\jason\detour

允許覆蓋 src。

建議完整重啟：
Ctrl + C
npx expo start -c

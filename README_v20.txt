DETOUR v0.20 — MISSION DIRECTOR + FOOD DECISION

這版不新增畫面，專門補「任務品質」和「Food 把決定丟回使用者」兩個洞。

MISSION DIRECTOR
以前：
- Side Quest 從 pool 隨機抽
- 可能連續出現很像的觀察任務
- Quiet / Weird / Wander 雖然有不同 pool，但節奏沒有被設計

現在：
- Mission 先依 sound / movement / pause / pattern / mystery / visual /
  photo / food 分 family
- 同一 family 不會連續出現（只要 pool 還有別的選擇）
- 第一個任務不會一開始就叫你停下來
- Wander 新增 LOOK BACK / COLOR ECHO / OLD + NEW
- Surprise 會跨多個 family，而不是只是亂抽
- 非攝影任務仍然可以用右下相機自由留下照片

FOOD
以前：
- 整條 Food 主線幾乎都在拍食物線索
- 最後還是叫使用者「決定要吃什麼」
- 15 分鐘也可能把你帶去不適合短空檔的 sit-down restaurant

現在：
- Food Side Quest 大部分使用一般可攜任務
- 只有最後一個 Side Quest 才出現食物 clue，因為那時已接近目的地
- 不要求一路上每一段都有餐廳/菜單
- Food 目的地會依可用時間加分：
  15min 偏 fast food / cafe / bakery / pastry / takeaway
  30min 偏 cafe / bakery / fast food，也可 restaurant
  60+min 才明顯提高 restaurant / food court / market
- 有 cuisine tag 會加分
- Arrival 不再問「今天要吃什麼」
- Arrival 直接說：今天就這裡。DETOUR 已替你選好目的地。
- 若 OSM 有 cuisine / 類型，會顯示台式、日式、咖啡店、烘焙等決策結果

重要：
這仍沒有接 OpenAI。
這版先讓 deterministic core loop 自己成立，之後 AI 才負責「更懂品味」，
不是負責修流程。

不需要新 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

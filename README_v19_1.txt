DETOUR v0.19.1 — SCENE COVERAGE FIX

這版修正 v0.19「室內/正式模式都組不出 DETOUR」的問題。

真正原因：
v0.19 在 routing 前就把 Scene 全部過濾掉了。
為了避免普通階梯當終點，品質 gate 設得太嚴，
在 OSM 標註較稀疏的住宅區容易得到 0 candidates。

現在改成兩層：

PRIMARY
- 壁畫 / 街頭藝術 / 公共藝術
- 市場
- 街頭書櫃
- heritage scene
- 文化空間（藝廊 / museum / arts centre）
- 其他資料足夠的 Scene

FALLBACK
- 資料較少但仍可玩的候選
- 有名字的公園 / 花園只在 fallback 才出現
- fallback 永遠排在 primary 後面

仍然禁止：
- 沒名字、沒特色的普通階梯
- 沒名字、沒特色的人行橋
- 沒名字、沒特色的 pedestrian way
- 沒身份資訊的 anonymous historic object
- 小廟/宗教場所仍不會進候選池

去過的 Scene：
以前是硬排除，附近候選少時可能直接把池子清空。
現在改成扣分；有新 Scene 時會優先新 Scene，
真的沒有時仍然能跑，不會因為你測過幾次就壞掉。

Routing：
從前 5 個候選增加到前 8 個依序測試，
降低「Scene 有找到但剛好前幾個 route snap 失敗」造成整趟失敗。

新增 fallback：
- named park / garden
- gallery / museum / arts centre

公園不是重新變成主角；它只負責在資料稀疏區避免 App 完全不能玩，
而且終點任務會要求找「綠地和城市的邊界」，不是叫你單純去公園。

不需要新 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

DETOUR v0.21 — RECOVERY / 換終點

這版補的是「現場不成立怎麼辦」。

Arrival 頁新增一個很低調的：
這裡不行 →

只有真的需要時才進 Recovery，不會污染 Main Quest。

原因可選：
- 沒開 / 已打烊
- 找不到 / 進不去
- 到現場覺得不值得
- 我現在不想去這裡

按下後 DETOUR 會：
1. 保存這個 Scene 的失敗原因
2. 保留所有已完成 Side Quest
3. 從你「現在的位置」重新找附近 Scene
4. 強制排除這趟已失敗的 Scene
5. 根據這趟剩餘時間限制新的步行距離
6. 算出新的真實 walking route
7. 不再插新的 Side Quest，直接進替代終點主線
8. Passport 記錄這趟發生過 Recovery

剩餘時間：
替代路線不會當成重新開一趟 DETOUR。
會依剩餘時間限制約 70–320m 的 recovery 步行距離。

如果附近真的沒有第二個適合且來得及走到的 Scene：
DETOUR 不會硬塞爛終點。
會讓你選：
- 回到目前 Scene
- 直接結束這次，已完成的路/任務仍存進 Passport

Engine learning：
closed
- 只在約 8 小時內輕微扣分，避免永久封殺只是當下休息的店

inaccessible
- 強烈扣分

not-worth-it
- 強烈扣分

wrong-now
- 只在短期內扣分

不需要新 npm 套件。

解壓到：
C:\Users\jason\detour

覆蓋 src。

建議：
Ctrl + C
npx expo start -c

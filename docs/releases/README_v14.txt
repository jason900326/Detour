DETOUR v0.14 — Camera Route Fix

目標：只修相機，不改產品流程。

這版把相機從 index.tsx 裡的 React Native Modal 拆成真正獨立的 Expo Router 畫面：
  src/app/camera.tsx

原因：iPhone 上相機 session 有啟動、快門也能拍到照片，但 live preview 在 Modal/動畫層級中持續黑屏。
這次不再替 Modal 打補丁，直接讓 CameraView 成為一個獨立的全螢幕 route。

安裝：
1. 解壓縮到 C:\Users\jason\detour
2. 覆蓋 src
3. 不需要新增 npm 套件（沿用 expo-camera / expo-file-system / expo-media-library / async-storage）
4. 建議 Ctrl+C 後執行 npx expo start -c，避免 Fast Refresh 保留舊 camera state。

測試：
- INDOOR TEST → 任意模式 → 進入一個有拍照或可選拍照的任務
- 打開相機
- 預期：背景直接顯示 live camera preview，而不是黑色
- 拍照後預期：同一個 camera route 直接切換到照片確認，不再開第二個 Modal
- 按「留下這張」後返回原本 Journey / Mission，並寫入 Passport
- 若照片權限允許，也會存入 iPhone Photos

如果獨立 route 仍然黑屏：
代表問題已不太可能是我們自己的 Modal / Animated layer，而要轉向 Expo Go + iOS + expo-camera runtime 相容性；下一步會改用 development build 驗證，而不是繼續亂改 UI。

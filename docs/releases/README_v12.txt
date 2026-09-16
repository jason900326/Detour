DETOUR v0.12 — OPTIONAL CAMERA + SKIP + CAMERA PREVIEW FIX

What changed
1. Not every mission requires a photo.
   - Quiet / sound / breathing / general observation missions can be completed without a photo.
   - A camera button remains available so the user can still save a moment if they want.
2. Photo-specific missions remain mandatory-photo missions.
   - Food evidence / Color Walk photo missions still require a photo.
3. Required-photo missions now include:
   「找不到這類型的東西，跳過這個任務」
4. Passport records DONE / SKIPPED for new missions.
5. Camera preview is now mounted inside a full-screen native Modal, with CameraView as a direct flex child.
   - Each camera opening forces a fresh CameraView mount.
   - Indoor Test exposes a small 「預覽黑畫面？重啟」 control for debugging.
   - The old duplicate CameraView block was removed.

Install
No new package is required beyond v0.11.
You should already have:
- expo-camera
- expo-file-system

Copy
Extract this ZIP into your project root:
C:\Users\jason\detour
and allow src to be overwritten.

Suggested test
INDOOR TEST → 15 MIN → 想安靜一下
- A sound/breathing mission should show:
  PHOTO OPTIONAL + 完成，回主線 + camera button.
- You should be able to finish without taking a photo.
- Or tap camera, take a photo, keep it, and return to the main quest.

Then test:
INDOOR TEST → 15 MIN → 吃點東西
- A food evidence mission should show PHOTO REQUIRED.
- The only normal completion path is taking a photo.
- If the required object cannot be found, use the skip action.

Camera test
When opening the camera, the live preview should now be visible behind the DETOUR overlay.
If Indoor Test is on and the preview is still black, tap 「預覽黑畫面？重啟」 once and report whether the preview appears.

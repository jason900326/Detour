DETOUR v0.13 — CAMERA POLISH + NEXT BEAT

Install once:
  npx expo install expo-media-library

Key changes:
- PHOTO CHECK is a dedicated full-screen modal.
- The camera result is copied to a stable app file before PHOTO CHECK.
- Accepted frames are saved to Passport and also imported into iPhone Photos.
- A DETOUR album is created/used when media-library access is granted.
- MAIN QUEST now shows distance to the next beat, not total hidden-destination distance.
- MAIN QUEST has a persistent optional camera button.
- Free photos never advance a mission.
- Required photo missions still require a photo or explicit skip.
- Sound / breathing / observation missions remain completable without a photo.

Test:
1. Enable INDOOR TEST.
2. Choose 15 min -> 想安靜一下.
3. Finish a non-photo mission without taking a photo.
4. On MAIN QUEST, tap the camera icon, shoot, and keep the frame.
5. PHOTO CHECK should show the actual shot.
6. The kept frame should appear in iPhone Photos.
7. Continue to a photo-required task and verify required-photo / skip behavior.

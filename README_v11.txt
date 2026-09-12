DETOUR v0.11 — DECIDE FOR ME + POSTCARD

This prototype update changes the product model:
- Camera is no longer a mood. Photography is part of every mission.
- Food missions no longer ask the user to decide what to eat. DETOUR gives the rule.
- Passport entries are clickable and open a Postcard detail view with photos, missions, and route trace.
- New photos are copied from camera cache into the app Documents directory so new Postcards can keep them across sessions.
- CameraView is mounted outside the animated screen container to address the iOS black-preview issue observed in v0.10.

INSTALL ONCE:
  npx expo install expo-file-system

Then copy/overwrite the src folder into your Detour project.

Suggested test:
1. Long-press DETOUR to enable INDOOR TEST.
2. Choose 15 min -> FOOD or WANDER.
3. Every side mission should end with taking a photo.
4. Complete the final photo mission.
5. Tap "打開這張 Postcard".
6. Return to Passport and tap any NEW card to reopen its Postcard.

Notes:
- Old Passport records from earlier versions do not contain saved photo URIs or mission history, so their detail view will explain that those fields are unavailable.
- Real destination/place names are not yet present because Scene Engine is still disconnected in indoor prototype mode.

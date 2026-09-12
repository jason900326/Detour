DETOUR v0.15.1 — PHOTO LIBRARY FIX

Fixes the real iPhone Photos saving bug in v0.15.

Cause:
The previous build used MediaLibrary.saveToLibraryAsync() from the main
expo-media-library package. In the current Expo MediaLibrary API that
legacy method is deprecated and can throw at runtime.

Fix:
- Uses Asset.create(localUri) to import the photo into iPhone Photos.
- Also tries to add the asset to a DETOUR album.
- The EXPOSED card now says SAVED TO PHOTOS or PASSPORT ONLY, so failures
  are no longer silently swallowed.

No new npm packages required.

Extract into:
C:\Users\jason\detour

Overwrite src/app/camera.tsx.

Recommended:
Ctrl + C
npx expo start -c

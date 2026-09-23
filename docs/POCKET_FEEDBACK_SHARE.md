# Pocket feedback and keepsake composition

Based on main `f6c4b27` / merged PR #76. The current request supersedes the older ticket-based share direction in PRODUCT_FOUNDATION.md and POCKET_PLAYTEST.md.

## Feedback

| Visible event | Haptic | Sound |
| --- | --- | --- |
| Objective revealed / new mission active | Light | Paper |
| Found it / recorded discovery | Medium, once | Soft wood |
| Photo successfully captured | Light | Muted mechanical click |
| New leg or upcoming turn visible | Heavy | Lower wood |
| Journey successfully saved as complete | Heavy then Medium, 160 ms apart | Two restrained wood knocks |

One mission cue per journey/target/reveal timestamp, including skips and optional closing missions. New missions are silent behind the camera and reveal after it closes. Direction cues wait 360 ms after becoming visible, are cancelled when hidden, and are deduplicated by journey and turn/destination coordinates. Compass/GPS renders do not trigger feedback. Opening the map, generic buttons and navigation are silent. The controller owns the single discovery event; saving/skipping its optional photo never repeats it. Discarding a short empty journey is silent.

Expo Haptics is reused; Expo Audio is SDK-matched. Players preload at the Pocket root, mix with existing audio, respect the iOS silent switch and stop in background. Unloaded/failed audio is dropped rather than replayed late. Haptics/audio failures never block game state. No recording permission or background audio service is added.

## Share design

Inspected the existing Pocket preview and captureRef implementation first: a percentage-height hero, expanding thumbnail columns, brand and phrase below; no route in the photo version, and an old Ticket in the empty version. Only the cover was gated on image readiness.

Dribbble references, inspected 2026-09-23:
- [Editorial Layout #5 (Map), Dennys Hess / Neonite](https://dribbble.com/shots/3259881-Editorial-Layout-5-Map): use a separate, breathing route composition and strong typographic hierarchy. Adaptation is a small orange geographic signature next to the photograph, without map labels or itinerary metadata.
- [Travel Journal Mobile App, Victoria Grinevich](https://dribbble.com/shots/26772110-Travel-Journal-Mobile-App): use quiet spacing and a photo-led personal-journal rhythm. Adaptation is a cover plus a fixed contact strip, rather than copying the reference's app screens.

Keep Detour's existing logo, cream paper, dark ink, orange, emoji and Traditional Chinese editorial voice. A 360 × 640 logical canvas scales all artwork and type together; export captures the very same native view at 1080 × 1920. The cover is always 208 × 260, secondary photos are always 72 × 90 in four fixed slots. One through five photos never change those dimensions; 2- and 4-photo journeys use the same fixed hero/thumbnail geometry and leave unused slots quiet. Missing thumbnails become quiet space, without empty frames, metadata or fake photos. Photos crop consistently to 4:5. The true route uses uniform geographic scaling and its own bounded frame. Without photos, the route becomes the main artwork; no ticket returns. Missing/stationary routes show a short text fallback rather than inventing geography.

Emoji and the final two-line phrase have reserved space below the photos. Preview controls remain outside the captured view. All displayed photos must load before export; capture waits two animation frames and locks against double taps. Font scaling is fixed only inside this artwork so system text sizing cannot rearrange the exported composition.

## Device checks

Browser verifies composition and flow; actual haptic strength, silent-switch behavior, native camera sound restrictions and iOS/Android captureRef/share sheets require a device. Test 0/1/3/5 photos, alternate covers, a missing image, camera skip, rapid Found taps, repeated GPS updates, backgrounding mid-cue, completion and history reopening. Installing expo-audio requires a new native development/production build; do not send this change as an OTA to a binary without that module.

Validation completed: architecture lint, TypeScript and all 50 unit tests passed; Expo iOS production JS/assets bundle succeeded. Browser checks used local fixture images at 320 px and 390 px viewport widths, including 0/1/2/3/4/5 images and changing the cover in the actual Pocket share screen. Hero, route, emoji and phrase geometry remains fixed across 1/2/3/4/5 images. Temporary review routes and sound source downloads are excluded from the app. Native hardware and image export remain device checks, not claimed as completed here. Version 0.49.0 creates a new appVersion runtime for expo-audio.


## Ticket archive and interrupted journeys

A stored active journey from a previous process no longer opens silently. Cold launch shows a quiet Detour paper card offering **繼續這趟** or **重新開始**. Background/cold-launch downtime is excluded from the journey clock using persisted foreground checkpoints, while an ordinary warm return resumes automatically without asking.

Ticket history is treated as a personal archive rather than an endless feed. The gallery keeps the existing paper/ticket identity, adds horizontal year/month chips using only months that actually exist, and can narrow to favourites. Favourite state is stored on the journey record. Destructive deletion lives in ticket detail behind a separate confirmation sheet; deleting a ticket also removes Detour-owned local photo files for that journey.

Layout references inspected 2026-09-23:
- [Travel Journal Mobile App, Victoria Grinevich / Dribbble](https://dribbble.com/shots/26772110-Travel-Journal-Mobile-App): quiet spacing and a memory-first editorial rhythm.
- [Travel app design / Waypath, Tino / Dribbble](https://dribbble.com/shots/26007658-Travel-app-design): modular travel-history cards and live date filtering.
- [Marco Cornacchia / Godly](https://godly.website/website/marco-cornacchia-860): clean grid discipline with a small number of strong controls.
- [099 / Godly](https://godly.website/website/099-956): minimal grid and restrained typographic hierarchy.

These are composition references only; Detour keeps its cream paper, orange accent, ticket stack, mono date labels and Traditional Chinese voice.

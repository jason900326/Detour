# Detour's quiet physical palette

All source assets are explicitly **CC0 1.0 Universal** (public domain dedication):
https://creativecommons.org/publicdomain/zero/1.0/
Verified and downloaded directly from the publishers on 2026-09-23. No attribution is required; credits are retained here.

| Output | Original / author | Source and license evidence | Processing |
| --- | --- | --- | --- |
| `mission-paper.wav` | `paper_sound_-_1.mp3`, Luckius | https://opengameart.org/content/various-paper-sound-effects — CC0 | Leading silence removed at −48 dB; 4.5 kHz low-pass; capped at 420 ms, 100 ms fade |
| `discovery-wood.wav` | `impactWood_light_000.ogg`, Kenney | https://kenney.nl/assets/impact-sounds — CC0; bundled `Kenney-Impact-LICENSE.txt` | 3.5 kHz low-pass; capped at 300 ms, 100 ms fade |
| `direction-wood.wav` | `impactWood_medium_000.ogg`, Kenney | Same Impact Sounds pack | 2.2 kHz low-pass; capped at 400 ms, 120 ms fade |
| `photo-click.wav` | `switch_002.ogg`, Kenney | https://kenney.nl/assets/interface-sounds — CC0; bundled `Kenney-Interface-LICENSE.txt` | 4.2 kHz low-pass; capped at 180 ms, 60 ms fade |
| `completion.wav` | Two wood recordings above | Kenney Impact Sounds, CC0 | Direction sound followed by discovery sound at +160 ms / 70% gain; peak limiter 0.8, no makeup gain |

Delivery: mono 44.1 kHz / 16-bit PCM WAV, compatible with iOS, Android and web. The five effects total less than 145 KB. No synthetic coin, sparkle or fanfare layers. Additional playback attenuation is centralized in `src/lib/pocket-feedback.ts`.

Direct downloads:
- https://opengameart.org/sites/default/files/paper_sound_-_1.mp3
- https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
- https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip

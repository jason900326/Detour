import { AppState } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const cues = {
  mission: { source: require("../../assets/audio/mission-paper.wav"), volume: 0.28, impact: Haptics.ImpactFeedbackStyle.Light },
  discovery: { source: require("../../assets/audio/discovery-wood.wav"), volume: 0.42, impact: Haptics.ImpactFeedbackStyle.Medium },
  photo: { source: require("../../assets/audio/photo-click.wav"), volume: 0.3, impact: Haptics.ImpactFeedbackStyle.Light },
  direction: { source: require("../../assets/audio/direction-wood.wav"), volume: 0.45, impact: Haptics.ImpactFeedbackStyle.Heavy },
  completion: { source: require("../../assets/audio/completion.wav"), volume: 0.48, impact: Haptics.ImpactFeedbackStyle.Heavy },
};
export type PocketFeedback = keyof typeof cues;
const players = new Map<PocketFeedback, AudioPlayer>();
let generation = 0;
let tail: ReturnType<typeof setTimeout> | undefined;

/** Preload once at the Pocket root; feedback never delays gameplay or requests audio permission. */
export function preparePocketFeedback() {
  let disposed = false;
  void setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: "mixWithOthers",
    shouldPlayInBackground: false,
    allowsRecording: false,
  }).then(() => {
    if (disposed) return;
    for (const event of Object.keys(cues) as PocketFeedback[]) {
      try {
        const player = createAudioPlayer(cues[event].source, { downloadFirst: true });
        player.volume = cues[event].volume;
        players.set(event, player);
      } catch { /* Haptics remain available when audio is unavailable. */ }
    }
  }).catch(() => {});
  const stop = () => {
    generation++;
    clearTimeout(tail);
    for (const player of players.values()) {
      try { player.pause(); } catch { /* Already released. */ }
    }
  };
  const subscription = AppState.addEventListener("change", state => {
    if (state !== "active") stop();
  });
  return () => {
    disposed = true;
    stop();
    subscription.remove();
    for (const player of players.values()) player.remove();
    players.clear();
  };
}

/** Call at the visible reveal / successful action, never from a generic press handler. */
export function playPocketFeedback(event: PocketFeedback) {
  if (AppState.currentState && AppState.currentState !== "active") return;
  const token = ++generation;
  clearTimeout(tail);
  void Haptics.impactAsync(cues[event].impact).catch(() => {});
  if (event === "completion") {
    tail = setTimeout(() => {
      if (token === generation)
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 160);
  }
  // Drop unloaded sounds instead of playing them late, after the animation.
  const player = players.get(event);
  if (!player?.isLoaded) return;
  void player.seekTo(0).then(() => {
    if (token === generation) player.play();
  }).catch(() => {});
}

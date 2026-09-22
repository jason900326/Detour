export type PocketScreen = "home" | "history" | "detail" | "share" | "settings";

export function previousPocketScreen(
  screen: PocketScreen,
  shareOrigin: "home" | "detail",
): PocketScreen | null {
  if (screen === "share") return shareOrigin;
  if (screen === "detail") return "history";
  if (screen === "history" || screen === "settings") return "home";
  // Home includes the live journey and completion; neither is a back stack.
  return null;
}

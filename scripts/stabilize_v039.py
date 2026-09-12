from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, before: str, after: str, label: str) -> str:
    if before not in text:
        raise RuntimeError(f'missing target: {label}')
    return text.replace(before, after, 1)


def regex_once(text: str, pattern: str, after: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, lambda _m: after, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'expected one replacement for {label}, got {count}')
    return updated


path = 'src/app/index.tsx'
text = read(path)

# The old manual Color Walk picker is no longer part of the product flow.
text = replace_once(text, "  | 'color'\n  | 'preparing'", "  | 'preparing'", 'remove color stage')

text = regex_once(
    text,
    r"\n  async function chooseColor\(color: ColorChoice\) \{.*?\n  \}\n\n  async function randomColor\(\) \{.*?\n  \}\n",
    "\n",
    'remove manual color chooser functions',
    flags=re.S,
)

text = replace_once(
    text,
    """    if (stage === 'color') {
      setSelectedMood(null);
      transitionTo('mood');
      return;
    }

""",
    "",
    'remove color-stage back handler',
)

text = regex_once(
    text,
    r"\n        \{stage === 'color' && \(.*?\n        \)\}\n\n        \{stage === 'preparing' && \(",
    "\n        {stage === 'preparing' && (",
    'remove manual color screen',
    flags=re.S,
)

# Re-score the warmed OSM data for the actual selected duration instead of
# reusing a 60-minute-scored candidate list for every ticket.
old_cached = """      const cachedCandidates = cached?.candidatesByMood[finalMood] ?? [];

      if (cached && cachedCandidates.length > 0) {
        startPoint = cached.point;
        context = cached.context;
        rankedCandidates = applyCachedRanking(
          cachedCandidates,
          cached.rankedIdsByMood[finalMood]
        );
        rankingUsedAI = cached.aiUsedByMood[finalMood] ?? false;

        advanceTicketProgress(
          0.58,
          `附近已先準備好。正在確認 ${rankedCandidates.length} 個候選的步行路線…`
        );
      } else {"""
new_cached = """      const cachedCandidates = cached?.candidatesByMood[finalMood] ?? [];

      if (cached && cachedCandidates.length > 0) {
        startPoint = cached.point;
        context = cached.context;

        // Prewarm is primarily an OSM/network warm-up. Candidate distance
        // scoring must still use the duration the user actually selected.
        const visitedSceneIds = passport
          .map((entry) => entry.sceneId)
          .filter((value): value is string => typeof value === 'string');
        const sceneFeedback = await loadSceneFeedback();
        const durationCandidates = await findSceneCandidates({
          start: startPoint,
          moodId: finalMood,
          context,
          minutes,
          excludeSceneIds: visitedSceneIds,
          feedback: sceneFeedback,
          distanceScale: paceDistanceScale,
        });

        if (durationCandidates.length === 0) {
          throw new Error(
            finalMood === 'food'
              ? '附近暫時找不到適合「吃東西」的真實食物 Scene。'
              : '附近暫時沒有找到適合現在情境的 Scene。'
          );
        }

        rankedCandidates = applyCachedRanking(
          durationCandidates,
          cached.rankedIdsByMood[finalMood]
        );
        rankingUsedAI =
          finalMood === 'food' || finalMood === 'color'
            ? false
            : cached.aiUsedByMood[finalMood] ?? false;

        advanceTicketProgress(
          0.58,
          `附近已先準備好。正在確認 ${rankedCandidates.length} 個候選的步行路線…`
        );
      } else {"""
text = replace_once(text, old_cached, new_cached, 'actual-duration candidate scoring')

# Initial slider position should explicitly use the five-node mapping rather
# than the old linear minute formula. 15 minutes is node 0.
text = replace_once(
    text,
    """  const timeSliderProgress = useRef(
    new Animated.Value((15 - TIME_MIN) / (TIME_MAX - TIME_MIN))
  ).current;
  const timeSliderWidthRef = useRef(1);
  const timeSliderStartProgressRef = useRef(
    (15 - TIME_MIN) / (TIME_MAX - TIME_MIN)
  );""",
    """  const timeSliderProgress = useRef(
    new Animated.Value(0)
  ).current;
  const timeSliderWidthRef = useRef(1);
  const timeSliderStartProgressRef = useRef(0);""",
    'explicit first slider node',
)

write(path, text)

# Bump the build marker to make the stabilization easy to identify.
path = 'src/lib/build-info.ts'
text = read(path)
text = text.replace("v0.39: five time nodes, six moods, task-free Color Walk, Food 80/20 weighting.", "v0.39.1: actual-duration prewarm scoring and no legacy Color Walk picker.")
text = text.replace("DETOUR_BUILD_VERSION = '0.39.0'", "DETOUR_BUILD_VERSION = '0.39.1'")
write(path, text)

print('v0.39 stabilization applied')

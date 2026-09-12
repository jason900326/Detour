from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, before: str, after: str, label: str) -> str:
    if before not in text:
        raise RuntimeError(f"missing replacement target: {label}")
    return text.replace(before, after, 1)


def regex_once(text: str, pattern: str, after: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, lambda _m: after, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"expected one regex replacement for {label}, got {count}")
    return updated


# ---------------------------------------------------------------------------
# src/lib/journey-engine.ts
# ---------------------------------------------------------------------------
path = "src/lib/journey-engine.ts"
text = read(path)

text = replace_once(
    text,
    """export type MoodId =
  | 'wander'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'photo'
  | 'surprise';""",
    """export type MoodId =
  | 'wander'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'color'
  | 'surprise';""",
    "MoodId color mode",
)

text = regex_once(
    text,
    r"export function getJourneyProfile\(minutes: number\): JourneyProfile \{.*?\n\}",
    """export function getJourneyProfile(minutes: number): JourneyProfile {
  // Public UI only offers 15 / 30 / 45 / 60 / 90. Keep 5–10 support
  // internally so short recovery legs can still be resolved safely.
  const safeMinutes = clamp(Math.round(minutes / 5) * 5, 5, 90);
  let targetDistanceMeters: number;
  let sideMissionCount: number;

  if (safeMinutes <= 5) {
    targetDistanceMeters = 220;
    sideMissionCount = 1;
  } else if (safeMinutes <= 10) {
    targetDistanceMeters = 420;
    sideMissionCount = 2;
  } else if (safeMinutes <= 15) {
    targetDistanceMeters = 680;
    sideMissionCount = 3;
  } else if (safeMinutes <= 30) {
    targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28);
    sideMissionCount = 4;
  } else if (safeMinutes <= 45) {
    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);
    sideMissionCount = 5;
  } else if (safeMinutes <= 60) {
    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);
    sideMissionCount = 5;
  } else {
    // 90 minutes is intentionally not 1.5× the 60-minute distance. The
    // extra time is budget for looking, photographing and city friction.
    targetDistanceMeters = Math.round(1700 + (safeMinutes - 60) * (400 / 30));
    sideMissionCount = 5;
  }

  const milestones = Array.from(
    { length: sideMissionCount },
    (_, index) =>
      Number((((index + 1) / (sideMissionCount + 1)) * 0.9).toFixed(2))
  );

  return { minutes: safeMinutes, targetDistanceMeters, sideMissionCount, milestones };
}""",
    "90-minute journey profile",
    flags=re.S,
)

text = regex_once(
    text,
    r"\n    \{\n      code: 'RED HIT',.*?\n      portable: true,\n    \},",
    """
    {
      code: 'ONE SCOOTER',
      family: 'visual',
      title: '拍一台機車。',
      instruction: `${nightNote} 停在路邊或沿路經過的都可以；不要走進車道。`,
      completion: '照片裡有一台清楚的機車。',
      photo: true,
      portable: true,
    },""",
    "remove red color mission",
    flags=re.S,
)

text = regex_once(
    text,
    r"\n    \{\n      code: 'BLUE HIT',.*?\n      portable: true,\n    \},",
    """
    {
      code: 'ONE BICYCLE',
      family: 'contrast',
      title: '拍一台腳踏車。',
      instruction: `${nightNote} 路邊停著的、共享單車或正在遠處經過的都可以；不要追人。`,
      completion: '照片裡有一台腳踏車。',
      photo: true,
      portable: true,
    },""",
    "remove blue color mission",
    flags=re.S,
)

text = regex_once(
    text,
    r"\n    \{\n      code: 'WHITE HIT',.*?\n      portable: true,\n    \},",
    """
    {
      code: 'ONE SIGN',
      family: 'visual',
      title: '拍一個路邊標示。',
      instruction: `${nightNote} 路牌、告示、店家標示或公共標誌都可以；第一個看得懂的就拍。`,
      completion: '照片裡有一個清楚可辨的標示。',
      photo: true,
      portable: true,
    },""",
    "remove white color mission",
    flags=re.S,
)

text = replace_once(
    text,
    """function arrivalMission(args: {
  moodId: MoodId;
  color?: ColorChoice | null;
}): Mission {

  if (args.moodId === 'quiet') {""",
    """function arrivalMission(args: {
  moodId: MoodId;
  color?: ColorChoice | null;
}): Mission {

  if (args.moodId === 'color') {
    return {
      id: 'arrival-color',
      code: 'ARRIVAL',
      title: '到了。',
      instruction: args.color
        ? `這趟一路找的是${args.color.label}。看到就拍，沒看到也不用回頭。`
        : '這趟的顏色散步到這裡結束。',
      completion: '抵達終點就完成這趟 DETOUR。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'quiet') {""",
    "Color Walk arrival",
)

text = replace_once(
    text,
    """  const unique = selectVariedMissions(
    cameraFirstSideMissions(args.context),
    profile.sideMissionCount
  );""",
    """  const unique =
    args.moodId === 'color'
      ? []
      : selectVariedMissions(
          cameraFirstSideMissions(args.context),
          profile.sideMissionCount
        );""",
    "Color Walk no Side Quests",
)

write(path, text)


# ---------------------------------------------------------------------------
# src/lib/routing-engine.ts
# ---------------------------------------------------------------------------
path = "src/lib/routing-engine.ts"
text = read(path)

text = regex_once(
    text,
    r"function targetDistance\(minutes: number\) \{.*?\n\}",
    """function targetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(90, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  if (safeMinutes <= 60) return Math.round(1430 + (safeMinutes - 45) * 18);

  // Long Detours reserve more of the time budget for finding and taking
  // photos instead of stretching the destination proportionally farther.
  return Math.round(1700 + (safeMinutes - 60) * (400 / 30));
}""",
    "routing supports 90 minutes",
    flags=re.S,
)

write(path, text)


# ---------------------------------------------------------------------------
# src/lib/scene-engine.ts
# ---------------------------------------------------------------------------
path = "src/lib/scene-engine.ts"
text = read(path)

text = replace_once(
    text,
    """    ['bakery', 'confectionery', 'deli', 'pastry'].includes(
      tags.shop ?? ''
    )""",
    """    ['bakery', 'confectionery', 'deli', 'pastry', 'beverages', 'coffee', 'tea'].includes(
      tags.shop ?? ''
    )""",
    "recognize drink shops",
)

text = regex_once(
    text,
    r"function journeyTargetDistance\(minutes: number\) \{.*?\n\}",
    """function journeyTargetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(90, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  if (safeMinutes <= 60) return Math.round(1430 + (safeMinutes - 45) * 18);
  return Math.round(1700 + (safeMinutes - 60) * (400 / 30));
}""",
    "scene distance supports 90 minutes",
    flags=re.S,
)

text = replace_once(
    text,
    """  const radius =
    moodId === 'food'
      ? 1400
      : 1800;""",
    """  const radius =
    moodId === 'food'
      ? 1700
      : 1800;""",
    "food discovery radius",
)

text = replace_once(
    text,
    """  nwr${around}[\"shop\"~\"bakery|confectionery|deli|pastry\"][\"name\"];""",
    """  nwr${around}[\"shop\"~\"bakery|confectionery|deli|pastry|beverages|coffee|tea\"][\"name\"];""",
    "food query includes drink shops",
)

write(path, text)


# ---------------------------------------------------------------------------
# src/app/index.tsx
# ---------------------------------------------------------------------------
path = "src/app/index.tsx"
text = read(path)

text = replace_once(
    text,
    """const TIME_MIN = 5;
const TIME_MAX = 60;
const TIME_STEP = 5;
const TIME_STEPS = Array.from(
  { length: (TIME_MAX - TIME_MIN) / TIME_STEP + 1 },
  (_, index) => TIME_MIN + index * TIME_STEP
);""",
    """const TIME_STEPS = [15, 30, 45, 60, 90] as const;
const TIME_MIN = TIME_STEPS[0];
const TIME_MAX = TIME_STEPS[TIME_STEPS.length - 1];""",
    "five public time nodes",
)

text = regex_once(
    text,
    r"const MOODS: Array<\{ id: MoodId; label: string; code: string \}> = \[.*?\n\];",
    """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走', code: 'WANDER' },
  { id: 'food', label: '吃東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜', code: 'QUIET' },
  { id: 'weird', label: '這是哪', code: 'WEIRD' },
  { id: 'color', label: '色色的', code: 'COLOR' },
  { id: 'surprise', label: '命運', code: 'SURPRISE' },
];""",
    "six mood grid",
    flags=re.S,
)

text = replace_once(
    text,
    """  if (moodId === 'weird') return '?';
  return '✦';""",
    """  if (moodId === 'weird') return '?';
  if (moodId === 'color') return '◉';
  return '✦';""",
    "Color Walk mood symbol",
)

text = replace_once(
    text,
    """  if (moodId === 'photo') {
    return '一路保留值得拍下來的畫面。';
  }""",
    """  if (moodId === 'color') {
    return '整趟只追同一個顏色。';
  }""",
    "Color Walk mood hint",
)

insert_after = """function moodHint(moodId: MoodId) {
"""
# Add food category helpers after moodHint's closing block, using ticketSerial as anchor.
food_helpers = """function isDrinkLikeFoodCandidate(scene: SceneCandidate) {
  const amenity = scene.tags.amenity ?? '';
  const shop = scene.tags.shop ?? '';
  const cuisine = (scene.tags.cuisine ?? '').toLowerCase();

  return (
    amenity === 'cafe' ||
    ['beverages', 'coffee', 'tea'].includes(shop) ||
    /(bubble_tea|tea|coffee|juice|smoothie)/.test(cuisine)
  );
}

function isMealFoodCandidate(scene: SceneCandidate) {
  return ['restaurant', 'fast_food', 'food_court'].includes(
    scene.tags.amenity ?? ''
  );
}

function applyFoodDestinationWeight(candidates: SceneCandidate[]) {
  // Product rule: when both groups are healthy enough, Food mode chooses a
  // drink-like destination about 80% of the time and a meal about 20%.
  const preferDrink = Math.random() < 0.8;
  const preferred = candidates.filter((scene) =>
    preferDrink ? isDrinkLikeFoodCandidate(scene) : isMealFoodCandidate(scene)
  );

  // Keep route quality/safety first. If there are too few candidates in the
  // rolled category, fall back to the full qualified pool.
  if (preferred.length >= 3) return preferred;

  return [
    ...preferred,
    ...candidates.filter((scene) => !preferred.includes(scene)),
  ];
}

"""
text = replace_once(
    text,
    """function ticketSerial(
""",
    food_helpers + """function ticketSerial(
""",
    "food destination weighting helpers",
)

text = regex_once(
    text,
    r"  const snapMinutesFromRatio = \(ratio: number\) =>\n    TIME_MIN \+\n    Math\.round\(\n      \(Math\.max\(0, Math\.min\(1, ratio\)\) \* \(TIME_MAX - TIME_MIN\)\) /\n        TIME_STEP\n    \) \*\n      TIME_STEP;",
    """  const timeIndexFromRatio = (ratio: number) =>
    Math.max(
      0,
      Math.min(
        TIME_STEPS.length - 1,
        Math.round(Math.max(0, Math.min(1, ratio)) * (TIME_STEPS.length - 1))
      )
    );

  const snapMinutesFromRatio = (ratio: number) =>
    TIME_STEPS[timeIndexFromRatio(ratio)];

  const ratioForMinutes = (minutes: number) => {
    const exactIndex = TIME_STEPS.findIndex((value) => value === minutes);
    const nearestIndex =
      exactIndex >= 0
        ? exactIndex
        : TIME_STEPS.reduce(
            (best, value, index) =>
              Math.abs(value - minutes) < Math.abs(TIME_STEPS[best] - minutes)
                ? index
                : best,
            0
          );

    return nearestIndex / (TIME_STEPS.length - 1);
  };""",
    "snap slider to five equal nodes",
)

text = replace_once(
    text,
    """    const snappedRatio =
      (nextMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN);""",
    """    const snappedRatio = ratioForMinutes(nextMinutes);""",
    "finish slider ratio",
)

text = replace_once(
    text,
    """    const nextRatio =
      (nextMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN);""",
    """    const nextRatio = ratioForMinutes(nextMinutes);""",
    "selected time slider ratio",
)

text = replace_once(
    text,
    """  async function chooseMood(moodId: MoodId) {
    await Haptics.selectionAsync();
    setSelectedMood(moodId);
    setSelectedColor(null);
  }""",
    """  async function chooseMood(moodId: MoodId) {
    await Haptics.selectionAsync();
    setSelectedMood(moodId);

    // Color Walk draws once per Detour session. Switching away and back keeps
    // the same draw, so there is no hidden reroll interaction.
    if (moodId === 'color' && !selectedColor) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setSelectedColor(color);
    }
  }""",
    "Color Walk draw once",
)

text = replace_once(
    text,
    """            if (candidates.length === 0) return;

            try {""",
    """            if (
              candidates.length === 0 ||
              moodId === 'food' ||
              moodId === 'color'
            ) return;

            try {""",
    "skip AI prewarm for weighted/special modes",
)

text = replace_once(
    text,
    """        if (isAIEngineConfigured()) {
          advanceTicketProgress(
            0.46,""",
    """        if (
          isAIEngineConfigured() &&
          finalMood !== 'food' &&
          finalMood !== 'color'
        ) {
          advanceTicketProgress(
            0.46,""",
    "skip AI rank for food and color",
)

text = replace_once(
    text,
    """      if (rankedCandidates.length === 0) {
        throw new Error('附近暫時沒有可用的 Scene。');
      }

      setLastAIResult(rankingUsedAI ? 'ai' : 'fallback');""",
    """      if (rankedCandidates.length === 0) {
        throw new Error('附近暫時沒有可用的 Scene。');
      }

      if (finalMood === 'food') {
        rankedCandidates = applyFoodDestinationWeight(rankedCandidates);
        rankingUsedAI = false;
      }

      setLastAIResult(rankingUsedAI ? 'ai' : 'fallback');""",
    "apply food 80/20 roll",
)

text = replace_once(
    text,
    """      nextPlan.arrivalMission = buildSceneArrivalMission({
        scene: routed.scene,
        moodId: finalMood,
        context,
      });""",
    """      if (finalMood !== 'color') {
        nextPlan.arrivalMission = buildSceneArrivalMission({
          scene: routed.scene,
          moodId: finalMood,
          context,
        });
      }""",
    "Color Walk keeps no-task arrival",
)

text = replace_once(
    text,
    """      // Arrival copy may get an AI polish later, but never blocks the ticket.
      if (isAIEngineConfigured()) {""",
    """      // Arrival copy may get an AI polish later, but never blocks the ticket.
      // Color Walk intentionally has no arrival task to rewrite.
      if (isAIEngineConfigured() && finalMood !== 'color') {""",
    "Color Walk skips AI arrival",
)

text = replace_once(
    text,
    """              ? '附近暫時找不到適合「吃點東西」的真實食物 Scene。'""",
    """              ? '附近暫時找不到適合「吃東西」的真實食物 Scene。'""",
    "Food mood copy",
)

text = replace_once(
    text,
    """      const aiRanking =
        await rankSceneCandidatesWithAI({
          candidates,
          moodId:
            recoveryMood,
          context:
            recoveryContext,
          minutes:
            recoveryMinutes,
        });""",
    """      const aiRanking =
        recoveryMood === 'food' || recoveryMood === 'color'
          ? { candidates, usedAI: false }
          : await rankSceneCandidatesWithAI({
              candidates,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
              minutes:
                recoveryMinutes,
            });""",
    "recovery preserves special-mode ranking",
)

text = replace_once(
    text,
    """      const fallbackArrival =
        buildSceneArrivalMission({
          scene: routed.scene,
          moodId:
            recoveryMood,
          context:
            recoveryContext,
        });

      const aiRecovery =
        await generateJourneyWithAI({
          scene: routed.scene,
          moodId:
            recoveryMood,
          context:
            recoveryContext,
          minutes:
            recoveryMinutes,
          sideMissionCount: 0,
          routeDistanceMeters:
            routed.route.distanceMeters,
          routeDurationSeconds:
            routed.route.durationSeconds,
        });""",
    """      const fallbackArrival =
        recoveryMood === 'color'
          ? currentPlan.arrivalMission
          : buildSceneArrivalMission({
              scene: routed.scene,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
            });

      const aiRecovery =
        recoveryMood === 'color'
          ? null
          : await generateJourneyWithAI({
              scene: routed.scene,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
              minutes:
                recoveryMinutes,
              sideMissionCount: 0,
              routeDistanceMeters:
                routed.route.distanceMeters,
              routeDurationSeconds:
                routed.route.durationSeconds,
            });""",
    "recovery keeps Color Walk task-free",
)

text = replace_once(
    text,
    """      id: 'wander' as MoodId,
      label: '隨便走走',""",
    """      id: 'wander' as MoodId,
      label: '隨便走',""",
    "default mood label",
)

text = replace_once(
    text,
    """    const missionForCamera: Mission | null =
      source === 'arrival'
        ? plan?.arrivalMission ?? null
        : source === 'free'
          ? FREE_CAMERA_MISSION
          : currentMission;""",
    """    const colorWalkCameraMission: Mission =
      selectedMood === 'color' && selectedColor
        ? {
            ...FREE_CAMERA_MISSION,
            id: `color-walk-${selectedColor.id}`,
            code: `COLOR · ${selectedColor.code}`,
            title: `拍下${selectedColor.label}。`,
            instruction: `看到${selectedColor.label}就拍；其他時間跟著導航走。`,
            completion: `這張照片留下今天的${selectedColor.label}。`,
          }
        : FREE_CAMERA_MISSION;

    const missionForCamera: Mission | null =
      source === 'arrival'
        ? plan?.arrivalMission ?? null
        : source === 'free'
          ? colorWalkCameraMission
          : currentMission;""",
    "Color Walk free camera prompt",
)

text = replace_once(
    text,
    """              {TIME_STEPS.map((minute) => {
                const progress = (minute - TIME_MIN) / (TIME_MAX - TIME_MIN);
                const showLabel = [5, 15, 30, 45, 60].includes(minute);
                return (
                  <View key={minute} pointerEvents="none" style={[styles.v35TickWrap, { left: `${progress * 100}%` }]}>
                    <View style={[styles.v35Tick, minute <= sliderDisplayMinutes && styles.v35TickActive]} />
                    {showLabel && <Text style={styles.v35TickLabel}>{minute}</Text>}
                  </View>
                );
              })}""",
    """              {TIME_STEPS.map((minute, index) => {
                const progress = index / (TIME_STEPS.length - 1);
                return (
                  <View key={minute} pointerEvents="none" style={[styles.v35TickWrap, { left: `${progress * 100}%` }]}>
                    <View style={[styles.v35Tick, minute <= sliderDisplayMinutes && styles.v35TickActive]} />
                    <Text style={styles.v35TickLabel}>{minute}</Text>
                  </View>
                );
              })}""",
    "render only five time ticks",
)

text = replace_once(
    text,
    """, item.id === 'surprise' && styles.v38MoodWide""",
    """""",
    "all mood cards same size",
)

text = replace_once(
    text,
    """<Text style={styles.v35PrintMood}>{mood?.label ?? '—'}</Text>""",
    """<Text style={styles.v35PrintMood}>{mood?.label ?? '—'}{selectedMood === 'color' && selectedColor ? ` · ${selectedColor.label}` : ''}</Text>""",
    "ticket printer reveals Color Walk draw",
)

text = replace_once(
    text,
    """              <Text style={styles.ticketReadySubtitle}>
                Scene、步行主線和任務都已鎖定。終點繼續保密。
              </Text>""",
    """              <Text style={styles.ticketReadySubtitle}>
                {selectedMood === 'color' && selectedColor
                  ? `這趟找${selectedColor.label}。看到就拍，其他時間跟著導航走。終點繼續保密。`
                  : 'Scene、步行主線和任務都已鎖定。終點繼續保密。'}
              </Text>""",
    "Color Walk ready instructions",
)

text = replace_once(
    text,
    """                    {mood?.label ?? '—'}""",
    """                    {mood?.label ?? '—'}{selectedMood === 'color' && selectedColor ? ` · ${selectedColor.label}` : ''}""",
    "ready ticket mood/color value",
)

text = replace_once(
    text,
    """              <View style={styles.detourTicketHighlights}>
                <Text style={styles.detourTicketHighlight}>
                  • 1 條隱藏主線
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • {previewProfile.sideMissionCount} 個支線任務
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • 1 個抵達任務
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • 終點先保密
                </Text>
              </View>""",
    """              <View style={styles.detourTicketHighlights}>
                {selectedMood === 'color' && selectedColor ? (
                  <>
                    <Text style={styles.detourTicketHighlight}>
                      • 這趟找{selectedColor.label}
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 看到就拿起相機
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 其他時間跟著導航走
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 終點先保密
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.detourTicketHighlight}>
                      • 1 條隱藏主線
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • {previewProfile.sideMissionCount} 個尋找
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 1 個抵達發現
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 終點先保密
                    </Text>
                  </>
                )}
              </View>""",
    "Color Walk ticket highlights",
)

text = replace_once(
    text,
    """                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>
                  {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}""",
    """                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>
                  {selectedMood === 'color' && selectedColor && (
                    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 999 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selectedColor.hex }} />
                      <Text style={{ color: BONE, fontSize: 15, fontWeight: '800' }}>今天找{selectedColor.label} · 看到就拍</Text>
                    </View>
                  )}
                  {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}""",
    "Color Walk journey reminder",
)

write(path, text)


# ---------------------------------------------------------------------------
# Version markers
# ---------------------------------------------------------------------------
path = "src/lib/playtest-analytics.ts"
text = read(path)
text = replace_once(text, "'0.38.0';", "'0.39.0';", "playtest version")
write(path, text)

path = "src/lib/build-info.ts"
text = read(path)
text = """// Lightweight marker so preview releases can be identified in Git history.
// v0.39: five time nodes, six moods, task-free Color Walk, Food 80/20 weighting.
export const DETOUR_BUILD_VERSION = '0.39.0';
"""
write(path, text)

print("v0.39 migration applied")

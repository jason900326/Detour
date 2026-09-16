export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MoodId =
  | 'wander'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'color'
  | 'surprise'
  | 'slow';

export type LightContext = 'day' | 'twilight' | 'night';

export type ColorId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

export type ColorChoice = {
  id: ColorId;
  label: string;
  code: string;
  hex: string;
};

export type MissionFamily =
  | 'sound'
  | 'movement'
  | 'pause'
  | 'pattern'
  | 'mystery'
  | 'food'
  | 'photo'
  | 'visual'
  | 'count'
  | 'contrast'
  | 'scale'
  | 'texture'
  | 'framing'
  | 'boundary'
  | 'perspective';

export type MissionGaze = 'up' | 'level' | 'down' | 'flex' | 'self';
export type MissionKind = 'photo-target' | 'context';

export type Mission = {
  id: string;
  code: string;
  family?: MissionFamily;
  kind?: MissionKind;
  gaze?: MissionGaze;
  title: string;
  instruction: string;
  completion: string;
  // true = photo is required by the current UI. The new product direction
  // treats photo targets as invitations rather than completion gates.
  photo: boolean;
  portable: boolean;
};

export type JourneyProfile = {
  minutes: number;
  targetDistanceMeters: number;
  sideMissionCount: number;
  milestones: number[];
};

export type JourneyPlan = {
  context: LightContext;
  contextCode: 'DAY' | 'TWILIGHT' | 'NIGHT';
  contextLabel: string;
  contextNote: string;
  profile: JourneyProfile;
  sideMissions: Mission[];
  arrivalMission: Mission;
};

export const COLORS: ColorChoice[] = [
  { id: 'red', label: '紅色', code: 'RED', hex: '#D93B2B' },
  { id: 'orange', label: '橘色', code: 'ORANGE', hex: '#FF6A2A' },
  { id: 'yellow', label: '黃色', code: 'YELLOW', hex: '#E7B928' },
  { id: 'green', label: '綠色', code: 'GREEN', hex: '#3F7A4A' },
  { id: 'blue', label: '藍色', code: 'BLUE', hex: '#2B5EA8' },
  { id: 'purple', label: '紫色', code: 'PURPLE', hex: '#7550A6' },
];

type PhotoTargetDefinition = {
  label: string;
  gaze: MissionGaze;
};

// 2026-09-16 pool reset.
// These 68 photo targets replace the previous Side Quest prompt pools.
// Keep targets objective and easy to judge at a glance. Do not add subjective
// qualifiers such as "漂亮", "有趣", "奇怪", etc.
export const PHOTO_TARGETS: readonly PhotoTargetDefinition[] = [
  { label: '冷氣室外機', gaze: 'up' },
  { label: '遮雨棚', gaze: 'up' },
  { label: '監視器', gaze: 'up' },
  { label: '路燈', gaze: 'up' },
  { label: '招牌', gaze: 'up' },
  { label: '外牆管線', gaze: 'up' },
  { label: '腳踏車', gaze: 'level' },
  { label: '機車', gaze: 'level' },
  { label: '凸面鏡', gaze: 'level' },
  { label: '郵筒', gaze: 'level' },
  { label: '消防栓', gaze: 'level' },
  { label: '電箱', gaze: 'level' },
  { label: '鐵捲門', gaze: 'level' },
  { label: '門牌', gaze: 'level' },
  { label: '公車站牌', gaze: 'level' },
  { label: '路名牌', gaze: 'level' },
  { label: '交通錐', gaze: 'level' },
  { label: '路障', gaze: 'level' },
  { label: '盆栽', gaze: 'level' },
  { label: '垃圾桶', gaze: 'level' },
  { label: '塑膠籃', gaze: 'level' },
  { label: '立牌', gaze: 'level' },
  { label: '菜單牌', gaze: 'level' },
  { label: '玻璃門', gaze: 'level' },
  { label: '鐵門', gaze: 'level' },
  { label: '信箱', gaze: 'level' },
  { label: '雨傘架', gaze: 'level' },
  { label: '滅火器', gaze: 'level' },
  { label: '施工圍籬', gaze: 'level' },
  { label: '公共座椅', gaze: 'level' },
  { label: '柱子', gaze: 'level' },
  { label: '排水孔', gaze: 'down' },
  { label: '導盲磚', gaze: 'down' },
  { label: '路緣石', gaze: 'down' },
  { label: '地磚', gaze: 'down' },
  { label: '磚面', gaze: 'down' },
  { label: '路面裂縫', gaze: 'down' },
  { label: '自行車道標誌', gaze: 'down' },
  { label: '粉筆記號', gaze: 'down' },
  { label: '落葉', gaze: 'down' },
  { label: '樹根', gaze: 'down' },
  { label: '踏墊', gaze: 'down' },
  { label: '階梯', gaze: 'down' },
  { label: '門檻', gaze: 'down' },
  { label: '磚縫', gaze: 'down' },
  { label: '數字', gaze: 'flex' },
  { label: '英文字母', gaze: 'flex' },
  { label: '箭頭', gaze: 'flex' },
  { label: '圓形物體', gaze: 'flex' },
  { label: '三角形物體', gaze: 'flex' },
  { label: '「停」字', gaze: 'flex' },
  { label: '無障礙符號', gaze: 'flex' },
  { label: '方形物體', gaze: 'flex' },
  { label: '樹枝', gaze: 'up' },
  { label: '雲', gaze: 'up' },
  { label: '目前看得到最高的建築', gaze: 'up' },
  { label: '窗戶', gaze: 'up' },
  { label: '積水', gaze: 'down' },
  { label: '倒影', gaze: 'down' },
  { label: '影子', gaze: 'down' },
  { label: '機車後照鏡', gaze: 'level' },
  { label: '玻璃上的反射', gaze: 'level' },
  { label: '花', gaze: 'level' },
  { label: '草', gaze: 'down' },
  { label: '現在穿的鞋子', gaze: 'self' },
  { label: '現在手上拿的東西', gaze: 'self' },
  { label: '今天穿的衣服', gaze: 'self' },
  { label: '自己的影子', gaze: 'self' },
];

// Context side events intentionally do not require photo or completion.
// They are meant to change the walking rhythm without forcing a detour,
// turning back, or a fixed success condition.
export const CONTEXT_SIDE_EVENTS: readonly string[] = [
  '找個地方坐一下。',
  '找個不擋路的地方停一下。',
  '有適合休息的地方，就休息一下。',
  '有遮蔭的地方，可以停一下。',
  '在街角停一下，看看人流。',
  '找個安全的位置停一下，看看車流。',
  '經過比較熱鬧的地方，可以停一下看看。',
  '經過比較安靜的地方，可以停一下。',
  '到比較開闊的地方時，停一下看看周圍。',
  '前面如果有可以坐的地方，就坐一下再走。',
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function getLightContext(
  point: GeoPoint,
  date = new Date()
): LightContext {
  const radians = Math.PI / 180;
  const latitude = point.latitude * radians;
  const days = dayOfYear(date);
  const localHour =
    date.getHours() +
    date.getMinutes() / 60 +
    date.getSeconds() / 3600;

  const gamma =
    (2 * Math.PI * (days - 1 + (localHour - 12) / 24)) / 365;

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timezoneHours = -date.getTimezoneOffset() / 60;
  const localMinutes =
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60;

  let trueSolarMinutes =
    localMinutes +
    equationOfTime +
    4 * point.longitude -
    60 * timezoneHours;

  trueSolarMinutes = ((trueSolarMinutes % 1440) + 1440) % 1440;

  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngle = hourAngleDegrees * radians;

  const cosineZenith = clamp(
    Math.sin(latitude) * Math.sin(declination) +
      Math.cos(latitude) *
        Math.cos(declination) *
        Math.cos(hourAngle),
    -1,
    1
  );

  const zenith = Math.acos(cosineZenith) / radians;
  const elevation = 90 - zenith;

  if (elevation > 0) return 'day';
  if (elevation > -6) return 'twilight';
  return 'night';
}

export function getContextMeta(context: LightContext) {
  if (context === 'night') {
    return {
      code: 'NIGHT' as const,
      label: '夜間',
      note: '只留在有照明、公開可走的位置。不要為了小插曲走進暗巷、封閉空間或偏僻角落。',
    };
  }

  if (context === 'twilight') {
    return {
      code: 'TWILIGHT' as const,
      label: '黃昏',
      note: '天色正在變暗。只在原本就能安全步行的範圍內留意沿路的小插曲。',
    };
  }

  return {
    code: 'DAY' as const,
    label: '白天',
    note: '小插曲只使用沿路就能注意到的內容，不要求為它改道。',
  };
}

export function getJourneyProfile(minutes: number): JourneyProfile {
  // Keep the existing journey timing behavior for now. The pool reset is
  // intentionally isolated from the new trigger/count system being designed.
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
    sideMissionCount = 2;
  } else if (safeMinutes <= 30) {
    targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28);
    sideMissionCount = 3;
  } else if (safeMinutes <= 45) {
    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);
    sideMissionCount = 4;
  } else if (safeMinutes <= 60) {
    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);
    sideMissionCount = 4;
  } else {
    targetDistanceMeters = Math.round(1700 + (safeMinutes - 60) * (400 / 30));
    sideMissionCount = 4;
  }

  const milestones = Array.from(
    { length: sideMissionCount },
    (_, index) =>
      Number((((index + 1) / (sideMissionCount + 1)) * 0.9).toFixed(2))
  );

  return { minutes: safeMinutes, targetDistanceMeters, sideMissionCount, milestones };
}

function photoMissionFamily(gaze: MissionGaze): MissionFamily {
  if (gaze === 'up') return 'perspective';
  if (gaze === 'down') return 'texture';
  if (gaze === 'flex') return 'pattern';
  if (gaze === 'self') return 'framing';
  return 'visual';
}

function photoPrompt(label: string, gaze: MissionGaze) {
  if (gaze === 'self') {
    if (label === '現在穿的鞋子') return '拍一下現在穿的鞋子。';
    if (label === '現在手上拿的東西') return '拍一下現在手上拿的東西。';
    if (label === '今天穿的衣服') return '拍一下今天穿的衣服。';
    if (label === '自己的影子') return '拍一下自己的影子。';
  }

  if (label === '目前看得到最高的建築') {
    return '找找看目前看得到最高的建築。';
  }

  return `找找看有沒有${label}。`;
}

function photoTargetMissions(): Mission[] {
  return PHOTO_TARGETS.map((target, index) => ({
    id: `photo-target-${index + 1}`,
    code: `PHOTO_TARGET_${String(index + 1).padStart(3, '0')}`,
    family: photoMissionFamily(target.gaze),
    kind: 'photo-target',
    gaze: target.gaze,
    title: photoPrompt(target.label, target.gaze),
    instruction:
      target.gaze === 'self'
        ? ''
        : '如果有的話拍下它。',
    completion: '',
    photo: true,
    portable: true,
  }));
}

function contextSideMissions(): Mission[] {
  return CONTEXT_SIDE_EVENTS.map((title, index) => ({
    id: `context-side-event-${index + 1}`,
    code: `CONTEXT_EVENT_${String(index + 1).padStart(2, '0')}`,
    family: 'pause',
    kind: 'context',
    gaze: 'flex',
    title,
    instruction: '',
    completion: '',
    photo: false,
    portable: true,
  }));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function missionFamily(mission: Mission): MissionFamily {
  if (mission.family) return mission.family;
  if (mission.photo) return 'photo';
  return 'visual';
}

function selectVariedMissions(pool: Mission[], count: number) {
  const shuffled = shuffle(pool);
  const selected: Mission[] = [];
  const usedIds = new Set<string>();

  while (selected.length < count && usedIds.size < shuffled.length) {
    const previousFamily =
      selected.length > 0
        ? missionFamily(selected[selected.length - 1])
        : null;

    let candidate =
      shuffled.find(
        (mission) =>
          !usedIds.has(mission.id) &&
          missionFamily(mission) !== previousFamily
      ) ??
      shuffled.find((mission) => !usedIds.has(mission.id));

    if (!candidate) break;

    // Do not begin a Detour by telling the user to stop.
    if (
      selected.length === 0 &&
      missionFamily(candidate) === 'pause'
    ) {
      const replacement = shuffled.find(
        (mission) =>
          !usedIds.has(mission.id) &&
          missionFamily(mission) !== 'pause'
      );

      if (replacement) candidate = replacement;
    }

    selected.push(candidate);
    usedIds.add(candidate.id);
  }

  return selected;
}

function arrivalMission(args: {
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

  if (args.moodId === 'quiet') {
    return {
      id: 'arrival-quiet',
      code: 'ARRIVAL',
      title: '到了。先不要離開。',
      instruction: '找出你現在最近的聲音和最遠的聲音，各聽一次。',
      completion: '兩個聲音都能指出來，就完成主線。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'weird') {
    return {
      id: 'arrival-weird',
      code: 'ARRIVAL',
      title: '到了。找一個不合理的細節。',
      instruction: '只看公共可見範圍。找一個你暫時不知道為什麼會在這裡的東西。',
      completion: '先猜一個理由，就完成主線。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'food') {
    return {
      id: 'arrival-food',
      code: 'ARRIVAL PROOF',
      title: '到了。拍下 DETOUR 的最後證據。',
      instruction: '這裡不再叫你決定要吃什麼。拍下目前最符合這趟「熱食」規則的公開食物線索；真正接回 Scene Engine 後，這一站會直接是一個由 DETOUR 選好的實際食物目的地。',
      completion: '拍下最後一個食物線索，就完成主線。',
      photo: true,
      portable: false,
    };
  }

  if (args.moodId === 'slow') {
    return {
      id: 'arrival-slow',
      code: 'ARRIVAL',
      title: '到了。',
      instruction: '這趟沒有走最快的路，但有好好走到你要去的地方。',
      completion: '抵達目的地就完成這趟 DETOUR。',
      photo: false,
      portable: true,
    };
  }

  return {
    id: 'arrival-wander',
    code: 'ARRIVAL',
    title: '到了。找一組反差。',
    instruction: '站在原地或公共可走範圍內，找兩個靠得很近、但材質、大小或用途明顯不同的東西。',
    completion: '兩個都指出來，就完成主線。',
    photo: false,
    portable: true,
  };
}

export function buildJourneyPlan(args: {
  minutes: number;
  moodId: MoodId;
  context: LightContext;
  color?: ColorChoice | null;
}): JourneyPlan {
  const profile = getJourneyProfile(args.minutes);
  const meta = getContextMeta(args.context);

  const pool = [
    ...photoTargetMissions(),
    ...contextSideMissions(),
  ];

  const unique =
    args.moodId === 'color'
      ? []
      : selectVariedMissions(
          pool,
          profile.sideMissionCount
        );

  return {
    context: args.context,
    contextCode: meta.code,
    contextLabel: meta.label,
    contextNote: meta.note,
    profile,
    sideMissions: unique,
    arrivalMission: arrivalMission({
      moodId: args.moodId,
      color: args.color,
    }),
  };
}

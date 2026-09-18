export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MoodId = 'wander' | 'food' | 'color';

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

// Arrival prompts are still destination-specific and are not part of the
// side-event scheduler. They are deliberately kept separate from SideEvent.
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

export type Mission = {
  id: string;
  code: string;
  family?: MissionFamily;
  title: string;
  instruction: string;
  completion: string;
  photo: boolean;
  portable: boolean;
};

export type SideEventGaze = 'up' | 'level' | 'down' | 'flex' | 'self';
export type SideEventKind = 'photo-target' | 'context';

export type SideEvent = {
  id: string;
  kind: SideEventKind;
  title: string;
  instruction: string;
  photoSuggested: boolean;
  gaze: SideEventGaze;
};

export type SideEventTriggerWindow = {
  slot: number;
  targetProgress: number;
  earliestProgress: number;
  latestProgress: number;
  targetMovingSeconds: number;
  latestMovingSeconds: number;
};

export type JourneyProfile = {
  minutes: number;
  targetDistanceMeters: number;
  sideEventCount: number;
  triggerWindows: SideEventTriggerWindow[];
};

export type JourneyPlan = {
  context: LightContext;
  contextCode: 'DAY' | 'TWILIGHT' | 'NIGHT';
  contextLabel: string;
  contextNote: string;
  profile: JourneyProfile;
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
  gaze: SideEventGaze;
};

// Reviewed 2026-09-16. Keep these objective and instantly judgeable. New
// targets can be appended later; this list is a starting pool, not a cap.
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

const PHOTO_SIDE_EVENTS: readonly SideEvent[] = PHOTO_TARGETS.map(
  (target, index) => ({
    id: `photo-${String(index + 1).padStart(3, '0')}`,
    kind: 'photo-target',
    gaze: target.gaze,
    title:
      target.gaze === 'self'
        ? target.label === '現在穿的鞋子'
          ? '拍一下現在穿的鞋子。'
          : target.label === '現在手上拿的東西'
            ? '拍一下現在手上拿的東西。'
            : target.label === '今天穿的衣服'
              ? '拍一下今天穿的衣服。'
              : '拍一下自己的影子。'
        : target.label === '目前看得到最高的建築'
          ? '找找看目前看得到最高的建築。'
          : `找找看有沒有${target.label}。`,
    instruction: target.gaze === 'self' ? '' : '如果有的話拍下它。',
    photoSuggested: true,
  })
);

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
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

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
    date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

  let trueSolarMinutes =
    localMinutes + equationOfTime + 4 * point.longitude - 60 * timezoneHours;

  trueSolarMinutes = ((trueSolarMinutes % 1440) + 1440) % 1440;

  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngle = hourAngleDegrees * radians;

  const cosineZenith = clamp(
    Math.sin(latitude) * Math.sin(declination) +
      Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle),
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

export function getSideEventCount(minutes: number) {
  if (minutes <= 15) return 3;
  if (minutes <= 25) return 5;
  if (minutes <= 35) return 7;
  if (minutes <= 45) return 9;
  return 10;
}

function targetDistance(minutes: number) {
  if (minutes <= 10) return 420;
  if (minutes <= 15) return 680;
  if (minutes <= 30) return Math.round(680 + (minutes - 15) * 28);
  if (minutes <= 45) return Math.round(1100 + (minutes - 30) * 22);
  return Math.round(1430 + (minutes - 45) * 18);
}

function buildTriggerWindows(minutes: number, count: number) {
  if (count <= 0) return [];

  const firstProgress = 0.06;
  const lastProgress = 0.9;
  const activeMovingBudget = minutes * 60 * 0.82;
  const firstMovingSeconds = Math.min(90, Math.max(45, minutes * 6));
  const lastMovingSeconds = activeMovingBudget * 0.92;

  return Array.from({ length: count }, (_, index): SideEventTriggerWindow => {
    const fraction = count === 1 ? 0 : index / (count - 1);
    const targetProgress =
      firstProgress + (lastProgress - firstProgress) * fraction;
    const targetMovingSeconds =
      firstMovingSeconds + (lastMovingSeconds - firstMovingSeconds) * fraction;

    return {
      slot: index,
      targetProgress: Number(targetProgress.toFixed(3)),
      earliestProgress: Number(Math.max(0, targetProgress - 0.045).toFixed(3)),
      latestProgress: Number(Math.min(0.96, targetProgress + 0.055).toFixed(3)),
      targetMovingSeconds: Math.round(targetMovingSeconds),
      latestMovingSeconds: Math.round(targetMovingSeconds + Math.max(75, minutes * 4)),
    };
  });
}

export function getJourneyProfile(minutes: number): JourneyProfile {
  const safeMinutes = clamp(Math.round(minutes / 5) * 5, 10, 60);
  const sideEventCount = getSideEventCount(safeMinutes);

  return {
    minutes: safeMinutes,
    targetDistanceMeters: targetDistance(safeMinutes),
    sideEventCount,
    triggerWindows: buildTriggerWindows(safeMinutes, sideEventCount),
  };
}

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function pickSideEvent(args: {
  seenIds?: Iterable<string>;
  previousGaze?: SideEventGaze | null;
}) {
  const seen = new Set(args.seenIds ?? []);

  const choose = (pool: readonly SideEvent[]) => {
    const shuffled = shuffle(pool);
    return (
      shuffled.find(
        (event) =>
          !seen.has(event.id) &&
          (!args.previousGaze || event.gaze !== args.previousGaze)
      ) ??
      shuffled.find((event) => !seen.has(event.id)) ??
      shuffled.find(
        (event) => !args.previousGaze || event.gaze !== args.previousGaze
      ) ??
      shuffled[0] ??
      null
    );
  };

  return choose(PHOTO_SIDE_EVENTS);
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
      completion: '',
      photo: false,
      portable: true,
    };
  }

  return {
    id: 'arrival-default',
    code: 'ARRIVAL',
    title: '到了。',
    instruction: '看看這次 DETOUR 把你帶到哪裡。',
    completion: '',
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
  const baseProfile = getJourneyProfile(args.minutes);
  const profile =
    args.moodId === 'color'
      ? { ...baseProfile, sideEventCount: 0, triggerWindows: [] }
      : baseProfile;
  const meta = getContextMeta(args.context);

  return {
    context: args.context,
    contextCode: meta.code,
    contextLabel: meta.label,
    contextNote: meta.note,
    profile,
    arrivalMission: arrivalMission({
      moodId: args.moodId,
      color: args.color,
    }),
  };
}

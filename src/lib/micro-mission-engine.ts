export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MoodId =
  | 'wander'
  | 'camera'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'surprise';

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

export type MicroMission = {
  id: number;
  code: string;
  title: string;
  instruction: string;
  completion: string;
  estimatedMinutes: number;
  photo: boolean;
};

export type MissionPlan = {
  context: LightContext;
  contextCode: 'DAY' | 'TWILIGHT' | 'NIGHT';
  contextLabel: string;
  contextNote: string;
  minutes: number;
  missionCount: number;
  missions: MicroMission[];
};

export const COLORS: ColorChoice[] = [
  { id: 'red', label: '紅色', code: 'RED', hex: '#D93B2B' },
  { id: 'orange', label: '橘色', code: 'ORANGE', hex: '#FF6A2A' },
  { id: 'yellow', label: '黃色', code: 'YELLOW', hex: '#E7B928' },
  { id: 'green', label: '綠色', code: 'GREEN', hex: '#3F7A4A' },
  { id: 'blue', label: '藍色', code: 'BLUE', hex: '#2B5EA8' },
  { id: 'purple', label: '紫色', code: 'PURPLE', hex: '#7550A6' },
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

  trueSolarMinutes =
    ((trueSolarMinutes % 1440) + 1440) % 1440;

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
      note: '只使用有照明、公共可進入的街道與空間；不用為了任務走進暗巷、封閉區域或偏僻角落。',
    };
  }

  if (context === 'twilight') {
    return {
      code: 'TWILIGHT' as const,
      label: '黃昏',
      note: '天色正在改變。任務會優先利用光線、招牌與街道邊界，不要求走進偏僻空間。',
    };
  }

  return {
    code: 'DAY' as const,
    label: '白天',
    note: '任務以步行中的觀察、轉向與短距離探索為主。',
  };
}

export function getMissionCount(minutes: number) {
  if (minutes <= 15) return 5;
  if (minutes <= 30) return 7;
  if (minutes <= 60) return 10;
  return 12;
}

function cameraMissions(
  color: ColorChoice,
  context: LightContext
): Omit<MicroMission, 'id'>[] {
  const colorName = color.label;

  const shared: Omit<MicroMission, 'id'>[] = [
    {
      code: 'FIRST HIT',
      title: `找到第一個${colorName}。`,
      instruction: `不用找漂亮的。沿著現在可安全行走的方向前進，看到第一個${colorName}物件就停。`,
      completion: `拍下第一個${colorName}，就完成。`,
      estimatedMinutes: 2,
      photo: true,
    },
    {
      code: 'SMALL SHARE',
      title: `讓${colorName}變小。`,
      instruction: `再找一次${colorName}，但這次不要讓它成為主角。把它壓到畫面的一小角。`,
      completion: '拍一張「第一眼不一定會注意到顏色」的照片。',
      estimatedMinutes: 3,
      photo: true,
    },
    {
      code: 'PAIR',
      title: `把兩個${colorName}放在一起。`,
      instruction: `找兩個彼此沒有關係、卻剛好同色的東西。想辦法讓它們同時進入畫面。`,
      completion: '兩個不同物件同時入鏡，就完成。',
      estimatedMinutes: 3,
      photo: true,
    },
    {
      code: 'EDGE',
      title: '不要站正中間。',
      instruction: `找到下一個${colorName}後，先換一個角度。讓門框、牆角、柱子或街道邊緣切進畫面。`,
      completion: '照片裡同時有顏色與一條明確邊界。',
      estimatedMinutes: 3,
      photo: true,
    },
    {
      code: 'REPEAT',
      title: `找三個一樣的${colorName}。`,
      instruction: `招牌、椅子、磁磚、車子都可以。找出三個重複出現的${colorName}元素。`,
      completion: '三個相似元素同時入鏡。',
      estimatedMinutes: 3,
      photo: true,
    },
    {
      code: 'OLD / NEW',
      title: '把新舊放在一起。',
      instruction: `找一個${colorName}的新東西，再找一個看起來比較舊的背景。把兩個年代壓在同一張照片裡。`,
      completion: '你能指出照片裡哪個比較新、哪個比較舊。',
      estimatedMinutes: 4,
      photo: true,
    },
    {
      code: 'INTERRUPTION',
      title: `找一個闖進${colorName}的東西。`,
      instruction: `先找到一大片${colorName}，再等一個不同顏色的人、車、影子或物件打斷它。`,
      completion: '拍到「同色區域被另一個元素切開」的瞬間。',
      estimatedMinutes: 4,
      photo: true,
    },
    {
      code: 'LAST FRAME',
      title: `最後一個${colorName}。`,
      instruction: `不要急著拍。繼續走，直到看到一個比前面幾張更像「今天的結尾」的${colorName}。`,
      completion: '選好最後一張，再完成這次 DETOUR。',
      estimatedMinutes: 4,
      photo: true,
    },
  ];

  if (context === 'night') {
    return [
      shared[0],
      {
        code: 'LIT / UNLIT',
        title: `找兩種亮度的${colorName}。`,
        instruction: `留在有照明的公共街道。找同一種${colorName}，讓一半落在光裡、一半落在比較暗的位置。`,
        completion: '一張照片裡能看出兩種亮度。',
        estimatedMinutes: 3,
        photo: true,
      },
      {
        code: 'REFLECTION',
        title: `找${colorName}的反射。`,
        instruction: `看玻璃、金屬、車窗或潮濕地面。不要走進暗處；只找你在公共街道上就看得到的反射。`,
        completion: '拍到的顏色不是直接來自主體，而是來自反射。',
        estimatedMinutes: 3,
        photo: true,
      },
      shared[2],
      {
        code: 'SIGN / STREET',
        title: '讓招牌不要像招牌。',
        instruction: `找到帶有${colorName}的發光文字或招牌，只取其中一小部分，連同街景一起拍。`,
        completion: '看不完整品牌名稱，但仍看得到夜晚街道。',
        estimatedMinutes: 3,
        photo: true,
      },
      shared[3],
      shared[6],
      shared[7],
      shared[4],
      shared[5],
      shared[1],
      shared[7],
    ];
  }

  if (context === 'twilight') {
    return [
      shared[0],
      {
        code: 'LAST LIGHT',
        title: `用最後的天光拍${colorName}。`,
        instruction: `不要朝暗處走。找一個仍被天空照到的${colorName}物件，讓天空或亮面留在照片裡。`,
        completion: '照片裡同時保留環境光與指定顏色。',
        estimatedMinutes: 3,
        photo: true,
      },
      shared[1],
      shared[2],
      shared[3],
      shared[6],
      shared[4],
      shared[5],
      shared[7],
      shared[1],
      shared[3],
      shared[7],
    ];
  }

  return [
    shared[0],
    shared[1],
    shared[2],
    shared[3],
    shared[4],
    shared[5],
    shared[6],
    shared[7],
    shared[2],
    shared[1],
    shared[3],
    shared[7],
  ];
}

function wanderMissions(context: LightContext): Omit<MicroMission, 'id'>[] {
  const night = context === 'night';

  return [
    {
      code: 'ONE BLOCK',
      title: '先走一個街口。',
      instruction: night
        ? '留在有照明、有人行走的公共街道。走到下一個街口，不需要找目的地。'
        : '沿現在的方向走到下一個街口，不需要找目的地。',
      completion: '抵達下一個街口就完成。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'NARROWER',
      title: '選比較不像主路的那邊。',
      instruction: night
        ? '下一個安全路口，從仍有照明與人行空間的方向裡，選較小的一條。不要進暗巷。'
        : '下一個安全路口，選一條比較小、但公開可走的街道。',
      completion: '轉進去並走到下一個明顯路口。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'THREE DOORS',
      title: '找三扇不一樣的門。',
      instruction: '不用停很久。一路走，找出三種不同材質、顏色或年代的入口。',
      completion: '看到第三種門，就完成。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'LOOK UP',
      title: '下一分鐘只看二樓以上。',
      instruction: '繼續走，但把注意力從地面移開。找招牌、陽台、窗戶或屋頂邊緣。',
      completion: '找到一個你站在原本視線高度不會注意到的東西。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'WRONG DETAIL',
      title: '找一個放錯地方的東西。',
      instruction: '可以是一張椅子、一個盆栽、一段管線、一塊招牌。重點是它讓你多看第二眼。',
      completion: '找到一個「為什麼在這裡？」的東西。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'SOUND TURN',
      title: '用聲音決定下一段。',
      instruction: night
        ? '站在明亮的公共路口，聽十秒。從仍安全、有人行空間的方向裡，往聲音比較多的那邊走。'
        : '在下一個路口停十秒。往你聽到最多城市聲音的方向走。',
      completion: '走到下一個街口。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'RETURN DIFFERENT',
      title: '不要原路回去。',
      instruction: '最後一段選一條不同、但你看得懂如何回到熟悉區域的公共路線。',
      completion: '重新看到一個你認得的地方，就完成。',
      estimatedMinutes: 4,
      photo: false,
    },
  ];
}

function quietMissions(context: LightContext): Omit<MicroMission, 'id'>[] {
  const night = context === 'night';

  return [
    {
      code: 'THREE SOUNDS',
      title: '先不要走。',
      instruction: '站在不擋路的位置二十秒。找出三個不同層次的聲音。',
      completion: '你能說出三個聲音，就完成。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'LOWER VOLUME',
      title: '找比較安靜的下一段。',
      instruction: night
        ? '只在有照明、公開可走的範圍內，選一條車聲稍微小一點的街道。不要往黑暗處走。'
        : '下一個路口，選車聲比較小、但公開可走的方向。',
      completion: '走一個街口後停下來。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'ONE THING',
      title: '只看一個東西。',
      instruction: '找一個固定不動的物件，看它三十秒。不要拍、不要查資料。',
      completion: '發現一個第一眼沒注意到的細節。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'SLOW BLOCK',
      title: '這一段故意走慢。',
      instruction: '下一個街口以前，把速度放到平常的一半。',
      completion: '走完整個街口，不超車、不趕路。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'PAUSE',
      title: '找一個不擋人的位置。',
      instruction: '停一分鐘。手機拿低一點，不需要做任何事。',
      completion: '一分鐘後再繼續。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'FAMILIAR',
      title: '找回一個熟悉的方向。',
      instruction: '不用導航。憑你現在對附近的感覺，慢慢往熟悉區域靠近。',
      completion: '看到一個你認得的街口或店面。',
      estimatedMinutes: 4,
      photo: false,
    },
  ];
}

function weirdMissions(context: LightContext): Omit<MicroMission, 'id'>[] {
  const night = context === 'night';

  return [
    {
      code: 'WHAT IS THAT',
      title: '找一個五秒看不懂的東西。',
      instruction: '只看公共空間裡的東西。先不要查它是什麼。',
      completion: '找到一個你第一眼說不出用途的物件。',
      estimatedMinutes: 2,
      photo: false,
    },
    {
      code: 'TOO SPECIFIC',
      title: '找一條過度具體的規則。',
      instruction: '看告示牌、手寫紙條、貼紙或公告。找一句只有這個地方才會出現的規則。',
      completion: '找到一條你想不到會被特別寫出來的規則。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'REPEATED',
      title: '找一個至少出現五次的形狀。',
      instruction: '可以是窗、洞、磁磚、欄杆、燈。不要刻意走遠。',
      completion: '同一種形狀數到五個。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'ODD LIGHT',
      title: night ? '找一盞奇怪的光。' : '找一塊奇怪的影子。',
      instruction: night
        ? '留在明亮公共街道。找顏色、角度或位置看起來不太合理的一盞光。'
        : '找一塊形狀不像它本體的影子。',
      completion: night ? '找到一盞讓你多看第二眼的光。' : '找到影子的來源。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'TINY MYSTERY',
      title: '留一個問題，不要解答。',
      instruction: '找到一個小小的城市謎題：一扇封起來的門、一條突然中斷的線、一個不知道誰在用的東西。',
      completion: '想出一句「為什麼？」就完成。不要查答案。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'BACK TO NORMAL',
      title: '回到普通的地方。',
      instruction: '往一個你看得懂、明亮且熟悉的公共方向走。',
      completion: '看到第一個讓你覺得「好，正常了」的場景。',
      estimatedMinutes: 4,
      photo: false,
    },
  ];
}

function foodMissions(context: LightContext): Omit<MicroMission, 'id'>[] {
  const night = context === 'night';

  return [
    {
      code: 'SMELL FIRST',
      title: '先用鼻子，不看地圖。',
      instruction: night
        ? '留在有人、有照明的商業街或公共街道。走到你聞到第一個明顯食物味道的位置。'
        : '沿公開街道走，找到第一個明顯的食物味道。',
      completion: '你能說出它比較像甜、鹹、烤、炸或香料哪一類。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'ONE MENU',
      title: '只看一張菜單。',
      instruction: '不要搜尋評分。選第一間你願意停下來看的店，只看門口菜單或價目。',
      completion: '找到一個你以前沒注意過的品項。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'UNDER 100',
      title: '找一個百元內的東西。',
      instruction: '不一定要買。看公開展示的價格，找到一個 100 元以內、你沒吃過或平常不會點的東西。',
      completion: '找到一個候選。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'QUEUE / NO QUEUE',
      title: '比較兩間店。',
      instruction: '找一間有人等、一間沒人等的店。不要下結論，只看它們各自賣什麼。',
      completion: '兩間都找到。',
      estimatedMinutes: 3,
      photo: false,
    },
    {
      code: 'PICK OR PASS',
      title: '現在才決定要不要吃。',
      instruction: '回想剛才看到的東西。想吃就選一個；不想吃也可以直接結束。',
      completion: '做出「吃 / 不吃」其中一個決定。',
      estimatedMinutes: 3,
      photo: false,
    },
  ];
}

function surpriseMissions(
  context: LightContext
): Omit<MicroMission, 'id'>[] {
  const pools = [
    ...wanderMissions(context),
    ...weirdMissions(context),
    ...quietMissions(context),
  ];

  const picks = [0, 8, 2, 11, 4, 14, 5, 9, 1, 12, 3, 15];
  return picks.map((index) => pools[index % pools.length]);
}

function repeatToLength<T>(items: T[], length: number) {
  const result: T[] = [];

  for (let index = 0; index < length; index += 1) {
    result.push(items[index % items.length]);
  }

  return result;
}

export function buildMissionPlan(args: {
  minutes: number;
  moodId: MoodId;
  context: LightContext;
  color?: ColorChoice | null;
}): MissionPlan {
  const count = getMissionCount(args.minutes);
  const meta = getContextMeta(args.context);
  const fallbackColor = COLORS[1];

  let pool: Omit<MicroMission, 'id'>[];

  if (args.moodId === 'camera') {
    pool = cameraMissions(args.color ?? fallbackColor, args.context);
  } else if (args.moodId === 'quiet') {
    pool = quietMissions(args.context);
  } else if (args.moodId === 'weird') {
    pool = weirdMissions(args.context);
  } else if (args.moodId === 'food') {
    pool = foodMissions(args.context);
  } else if (args.moodId === 'surprise') {
    pool = surpriseMissions(args.context);
  } else {
    pool = wanderMissions(args.context);
  }

  const missions = repeatToLength(pool, count).map((mission, index) => ({
    ...mission,
    id: index + 1,
  }));

  return {
    context: args.context,
    contextCode: meta.code,
    contextLabel: meta.label,
    contextNote: meta.note,
    minutes: args.minutes,
    missionCount: missions.length,
    missions,
  };
}

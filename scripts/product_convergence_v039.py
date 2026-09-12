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


def regex_once(text: str, pattern: str, after, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, after, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'expected one replacement for {label}, got {count}')
    return updated


# ---------------------------------------------------------------------------
# PRODUCT FOUNDATION: lock the product-language decisions into the baseline.
# ---------------------------------------------------------------------------
path = 'PRODUCT_FOUNDATION.md'
text = read(path)
anchor = '## 12. UI / 氣質\n'
insert = '''### v0.39 產品語言收斂：體驗要自己說明自己\n\n產品定位不應靠一堆說明文字成立。使用者應該從「選時間 → 選一種狀態 → 出票 → 開始找東西 → 抵達 → 留下票根」直接理解 Detour 是什麼。\n\n**第一個正在找的東西，就是最重要的 onboarding。**\n\n因此消費者介面要遵守以下硬規則：\n\n1. **一般尋找不是 Side Quest。**\n   - 它不是附加玩法，而是 Detour 讓普通街道變成遊戲的主要機制。\n   - 一般 Mood 在旅程中應盡量一直有一個「現在正在找什麼」。\n   - 任務密度不能為了少看手機而被砍到只剩導航。\n\n2. **降低的是螢幕負擔，不是事件密度。**\n   - 題目看一眼就能記住。\n   - 使用者可以收起手機，帶著目標繼續走。\n   - 找到時再拿起相機。\n   - 下一個尋找應自然接上，讓 Detour 持續存在在腦中。\n\n3. **遊戲感不要靠遊戲術語硬講。**\n   - 消費者介面不要顯示 `SIDE QUEST`、`MAIN QUEST`、`FIELD EVENT`、`CLEAR CONDITION`、`ARRIVAL`、`ROUTE LOCKED` 等系統字樣。\n   - 遊戲感來自出票、未知、尋找、路線變化、震動、抵達、剪票與收藏。\n   - UI 只需要直接告訴使用者下一件事，例如「拍一台機車。」、「看到就拍」、「終點揭曉」。\n\n4. **英文白名單非常窄。**\n   - `DETOUR` 品牌 / Logo 可以保留。\n   - OpenStreetMap、iPhone 等必要專有名詞可以在必要情境出現。\n   - 其他消費者介面預設使用台灣繁體中文。\n   - 車票可以保留序號、條碼、符號等視覺語彙，但不要靠裝飾性英文製造「酷」。\n\n5. **設定必須像使用者設定，不像開發面板。**\n   - 正常使用者只需要看到步行節奏、導覽、旅程資料、定位 / 隱私等必要內容。\n   - AI、Playtest、室內模擬、backend 狀態等工程工具應藏在開發者入口。\n   - 不要在正式設定頁出現 `SETTINGS / PROTOTYPE / FIRST RUN / DATA / BACKEND / CONFIGURED` 這類字樣。\n\n6. **相機是工具，不是另一個遊戲介面。**\n   - 保留取景、鏡頭、閃光、快門、目前尋找即可。\n   - 不需要 `ROLL / EXPOSED / NEXT FRAME / MISSION FRAME` 等大量英文狀態。\n   - 按下快門後快速回到旅程，讓拍照服務於探索，不要中斷探索。\n\n7. **Onboarding 要少，而且可被體驗取代。**\n   - 不用長篇解釋產品哲學。\n   - 每頁只講一件事；能由第一個尋找教會的，就不要再寫一段文字。\n   - 隱私與測試資料說明應放在適合的位置，不要塞進第一次使用的主敘事。\n\n8. **Color Walk 是唯一例外。**\n   - 「色色的」沒有一般尋找任務；整趟唯一規則就是追同一個隨機顏色。\n   - 一般 Mood 不得用大量純顏色題目稀釋 Color Walk 的辨識度。\n\n### 一般 Mood 的尋找密度方向\n\n目前 Playtest 起始值提高為：\n- 15 分鐘：約 3 個尋找。\n- 30 分鐘：約 4 個尋找。\n- 45 分鐘：約 6 個尋找。\n- 60 分鐘：約 7 個尋找。\n- 90 分鐘：約 10 個尋找。\n\n這些不是永遠固定的 KPI，而是為了避免「任務太少 → 中間只剩走路 → Detour 退化成導航」的測試起點。未來應依實走完成率、跳過率與螢幕負擔調整。\n\n---\n\n'''
if '### v0.39 產品語言收斂：體驗要自己說明自己' not in text:
    text = replace_once(text, anchor, insert + anchor, 'foundation product-language convergence section')
write(path, text)


# ---------------------------------------------------------------------------
# MISSION DENSITY: keep Detour present throughout normal journeys.
# Color Walk remains task-free through buildJourneyPlan().
# ---------------------------------------------------------------------------
path = 'src/lib/journey-engine.ts'
text = read(path)
text = replace_once(
    text,
    '''  } else if (safeMinutes <= 45) {\n    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);\n    sideMissionCount = 5;\n  } else if (safeMinutes <= 60) {\n    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);\n    sideMissionCount = 5;\n  } else {\n    // 90 minutes is intentionally not 1.5× the 60-minute distance. The\n    // extra time is budget for looking, photographing and city friction.\n    targetDistanceMeters = Math.round(1700 + (safeMinutes - 60) * (400 / 30));\n    sideMissionCount = 5;\n  }''',
    '''  } else if (safeMinutes <= 45) {\n    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);\n    sideMissionCount = 6;\n  } else if (safeMinutes <= 60) {\n    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);\n    sideMissionCount = 7;\n  } else {\n    // 90 minutes is intentionally not 1.5× the 60-minute distance. The\n    // extra time is budget for looking, photographing and city friction.\n    targetDistanceMeters = Math.round(1700 + (safeMinutes - 60) * (400 / 30));\n    // Keep a live Find present through a long Detour without turning it into\n    // a checklist. Public 90-minute journeys start around ten simple finds.\n    sideMissionCount = Math.min(10, Math.round(7 + (safeMinutes - 60) / 10));\n  }''',
    'normal mood mission density'
)
write(path, text)


# ---------------------------------------------------------------------------
# MAIN APP: Chinese-first consumer surface + Find as primary gameplay.
# ---------------------------------------------------------------------------
path = 'src/app/index.tsx'
text = read(path)

# Onboarding: remove presentation-style English and cut explanation copy.
replacements = [
    ('                    THE PROMISE', '                    先選時間', 'onboarding heading 1'),
    ('                    你只選空檔和現在的心情。DETOUR\n                    會決定方向、Scene，還有路上會發生什麼。', '                    你只要選時間，還有這次想怎麼晃。', 'onboarding body 1'),
    ('''                  <Text style={styles.onboardingNote}>\n                    不是景點清單，也不用先規劃。\n                  </Text>\n''', '', 'remove onboarding note 1'),
    ('                    HIDDEN DESTINATION', '                    終點先保密', 'onboarding heading 2'),
    ('                    主線只告訴你下一小段的方向與距離。\n                    真的看不懂時，點箭頭才看那一小段地圖。', '                    照方向走。真的看不懂，再打開那一小段地圖。', 'onboarding body 2'),
    ('''                  <Text style={styles.onboardingNote}>\n                    不是要你盲走，只是不把整趟一開始就說完。\n                  </Text>\n''', '', 'remove onboarding note 2'),
    ('                    YOU CAN CHANGE IT', '                    不對就換', 'onboarding heading 3'),
    ('                    店沒開、進不去、到了覺得不值得，都可以換終點。\n                    已完成的任務不會消失。', '                    店沒開、進不去、不值得，就換下一個。', 'onboarding body 3'),
    ('''                  <Text style={styles.onboardingNote}>\n                    定位只在開始 DETOUR 後使用。測試版會匿名回傳完成率、\n                    AI / fallback 與你的簡短評分；不包含 GPS、路線、照片或目的地名稱。\n                  </Text>\n''', '', 'remove onboarding note 3'),
]
for before, after, label in replacements:
    text = replace_once(text, before, after, label)

# Settings: Chinese-first. Developer diagnostics become hidden behind a long
# press on the 設定 title; devMode still exposes the existing tools.
text = replace_once(
    text,
    '''              <Text style={styles.settingsBrand}>\n                SETTINGS\n              </Text>''',
    '''              <Pressable\n                onLongPress={toggleDevMode}\n                delayLongPress={900}\n                hitSlop={10}\n              >\n                <Text style={styles.settingsBrand}>\n                  設定\n                </Text>\n              </Pressable>''',
    'settings hidden developer entrance'
)
text = replace_once(text, '                  WALK YOUR WAY', '                  調整步調', 'settings hero eyebrow')
text = replace_once(
    text,
    '''                        <Text style={styles.settingsChoiceCode}>\n                          {pace.code}\n                        </Text>\n''',
    '',
    'remove pace English codes'
)
text = replace_once(text, '                  FIRST RUN', '                  開始導覽', 'settings first run label')
text = replace_once(text, '                      不會清除 Passport 或偏好。', '                      不會清除旅程收藏或偏好。', 'settings onboarding note')
text = replace_once(text, '                  DATA', '                  旅程資料', 'settings data label')
text = replace_once(text, '                    PASSPORT', '                    已完成旅程', 'settings passport label')
text = replace_once(text, '                    {passport.length} DETOURS', '                    {passport.length} 趟', 'settings passport count')
text = replace_once(text, '                    清除測試 Passport', '                    清除已完成旅程', 'settings clear passport')
text = replace_once(text, '                  LOCATION', '                  定位', 'settings location label')
text = replace_once(text, '                  旅程中的 GPS 軌跡仍只留在手機。', '                  旅程中的定位軌跡仍只留在手機。', 'settings location body')

# Hide three engineering sections while preserving consumer sections.
def wrap_settings_section(source: str, label: str, next_marker: str) -> str:
    pattern = (
        r'(              <View style=\{styles\.settingsSection\}>\n'
        r'                <Text style=\{styles\.settingsSectionLabel\}>\n'
        + re.escape('                  ' + label) +
        r'\n                </Text>.*?\n              </View>)'
        + r'(?=\n\n' + re.escape(next_marker) + r')'
    )
    def repl(match):
        block = match.group(1)
        return '              {devMode && (\n' + block + '\n              )}'
    updated, count = re.subn(pattern, repl, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'expected one developer settings section: {label}, got {count}')
    return updated

text = wrap_settings_section(
    text,
    'PROTOTYPE',
    '              <View style={styles.settingsSection}>\n                <Text style={styles.settingsSectionLabel}>\n                  開始導覽'
)
text = wrap_settings_section(
    text,
    'AI ENGINE',
    '              <View style={styles.settingsSection}>\n                <Text style={styles.settingsSectionLabel}>\n                  PLAYTEST DATA'
)
text = wrap_settings_section(
    text,
    'PLAYTEST DATA',
    '              <View style={styles.settingsPrivacy}>'
)

# Time and Mood: remove MIN from normal consumer UI.
text = replace_once(text, '<Text style={styles.v35MinuteUnit}>MIN</Text>', '<Text style={styles.v35MinuteUnit}>分</Text>', 'home minute unit')
text = replace_once(text, '<Text style={styles.v35TimePillText}>{selectedTime} MIN</Text>', '<Text style={styles.v35TimePillText}>{selectedTime} 分</Text>', 'mood minute unit')

# Ticket reveal: keep the ticket feel but make the visible language Chinese.
ticket_replacements = [
    ('                TICKET READY', '                車票好了', 'ticket ready meta'),
    ('                YOUR ROUTE IS READY', '                可以出發了', 'ticket ready eyebrow'),
    ('                你的 DETOUR{`\\n`}\n                已經開好了。', '                這張 DETOUR{`\\n`}\n                可以出發了。', 'ticket ready title'),
    ("                  : 'Scene、步行主線和任務都已鎖定。終點繼續保密。'}", "                  : '方向和路上的尋找都準備好了。終點繼續保密。'}", 'ticket ready subtitle'),
    ('                    YOUR ROUTE IS READY', '                    終點保密', 'ticket microcopy'),
    ('                    TIME', '                    時間', 'ticket fact time'),
    ('                    {selectedTime} MIN', '                    {selectedTime} 分', 'ticket time value'),
    ('                    MOOD', '                    心情', 'ticket fact mood'),
    ('                    START', '                    出發', 'ticket fact start'),
    ('                    NOW', '                    現在', 'ticket fact now'),
    ('                HIGHLIGHTS', '                這趟', 'ticket highlights'),
    ('                  KEEP EXPLORING', '                  去走走', 'ticket footnote'),
    ('                  ROUTE LOCKED', '                  路線好了', 'ticket stamp'),
    ('                INDOOR TEST · 真實 Scene / 真實 Route', '                室內測試 · 真實終點 / 路線', 'indoor test label'),
]
for before, after, label in ticket_replacements:
    text = replace_once(text, before, after, label)

# Journey: keep a live Find visible from the start. The milestone mission page
# becomes a reminder, not the first moment the objective exists.
text = replace_once(
    text,
    '''                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>\n                  {selectedMood === 'color' && selectedColor && (''',
    '''                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>\n                  {selectedMood !== 'color' && currentMission && (\n                    <Pressable\n                      onPress={() => openCamera('side')}\n                      style={({ pressed }) => [{ marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 16 }, pressed && styles.v35JourneyPressed]}\n                    >\n                      <Text numberOfLines={1} style={{ flex: 1, color: BONE, fontSize: 17, fontWeight: '800' }}>{currentMission.title}</Text>\n                      <Text style={{ color: SIGNAL, fontSize: 12, fontWeight: '800' }}>看到就拍</Text>\n                    </Pressable>\n                  )}\n                  {selectedMood === 'color' && selectedColor && (''',
    'persistent active find chip'
)
text = replace_once(text, "{questPulse === 'side' ? '路上任務出現' : '抵達終點'}", "{questPulse === 'side' ? '還在找這個' : '到終點了'}", 'journey pulse language')
text = replace_once(text, '<Text style={styles.v35JourneyPrimaryText}>繼續前進</Text>', '<Text style={styles.v35JourneyPrimaryText}>看下一段路</Text>', 'journey map button')

# Mission screen: Find is the main gameplay, not a Side Quest system screen.
mission_replacements = [
    ('                FIELD EVENT', '                尋找', 'mission meta'),
    ('                MAIN QUEST CONTINUES', '                找到就拍，找不到就繼續走', 'mission route label'),
    ('                SIDE QUEST · {currentMission.code}', '                路上找這個', 'mission eyebrow'),
    ('                      找不到，跳過這個任務', '                      找不到，先跳過', 'mission skip'),
    ('                      完成這個 Side Quest', '                      完成', 'legacy mission completion'),
]
for before, after, label in mission_replacements:
    text = replace_once(text, before, after, label)
text = regex_once(
    text,
    r'''\n              <View style=\{styles\.fieldEventRule\}>\n                <Text style=\{styles\.fieldEventRuleLabel\}>\n                  CLEAR CONDITION\n                </Text>\n                <Text style=\{styles\.fieldEventRuleText\}>\n                  \{currentMission\.completion\}\n                </Text>\n              </View>''',
    '',
    'remove mission clear-condition block'
)

# Arrival: reveal the destination directly, without exposing internal game terms.
arrival_replacements = [
    ("                {selectedScene?.label ?? 'ARRIVAL'}", "                {selectedScene?.label ?? '抵達'}", 'arrival fallback'),
    ('                DESTINATION REVEALED', '                終點揭曉', 'arrival reveal label'),
    ('                MAIN QUEST · ARRIVAL', '                到了', 'arrival kicker'),
    ('                      找不到，跳過最後任務', '                      找不到，先完成這趟', 'arrival skip'),
    ('                Scene + walking route · OpenStreetMap', '                地圖資料：OpenStreetMap', 'arrival source'),
]
for before, after, label in arrival_replacements:
    text = replace_once(text, before, after, label)
text = regex_once(
    text,
    r'''\n              <Text style=\{styles\.cleanArrivalCode\}>\n                \{plan\.arrivalMission\.code\}\n              </Text>''',
    '',
    'remove arrival internal code'
)
text = regex_once(
    text,
    r'''\n              <Text style=\{styles\.cleanArrivalCompletion\}>\n                完成：\{plan\.arrivalMission\.completion\}\n              </Text>''',
    '',
    'remove arrival redundant completion line'
)

# Replacement destination screen: remove internal route/game English.
scene_replacements = [
    ('                ROUTE REISSUE', '                換一條', 'reissue meta'),
    ('                    CURRENT ROUTE', '                    目前路線', 'reissue route label'),
    ('                    INTERRUPTED', '                    中斷', 'reissue status'),
    ('                    已走過的路和 Side Quest 保留', '                    已走過的路和尋找會保留', 'reissue route foot'),
    ("                  THIS ONE DOESN'T WORK", '                  這個終點不行', 'reissue eyebrow'),
    ('                  告訴 DETOUR 發生什麼事。會從你現在的位置重新找終點，不會重跑已完成的任務。', '                  從你現在的位置換一個終點；已完成的尋找會保留。', 'reissue body'),
    ("                    note: 'Scene 不夠有趣',", "                    note: '這裡不夠有趣',", 'reissue scene note'),
]
for before, after, label in scene_replacements:
    text = replace_once(text, before, after, label)

# Developing screen.
developing_replacements = [
    ("                ROLL {String(passport.length).padStart(2, '0')}", "                第 {String(passport.length + 1).padStart(2, '0')} 趟", 'developing meta'),
    ('              <Text style={styles.developingCode}>DEVELOPING</Text>', '<Text style={styles.developingCode}>正在整理</Text>', 'developing code'),
    ("                {photos.length} FRAME{photos.length === 1 ? '' : 'S'} ·{' '}\n                {contextCode(lightContext)}", '                {photos.length} 張照片', 'developing body'),
]
for before, after, label in developing_replacements:
    text = replace_once(text, before, after, label)

# Passport and share ticket: Chinese-first consumer collection surface.
passport_replacements = [
    ('              <Text style={styles.meta}>TAIPEI</Text>', '              <Text style={styles.meta}>收藏</Text>', 'passport meta'),
    ('                  <Text style={styles.passportStatLabel}>DETOURS</Text>', '                  <Text style={styles.passportStatLabel}>趟旅程</Text>', 'passport detours label'),
    ('                  <Text style={styles.passportStatLabel}>KM TRACED</Text>', '                  <Text style={styles.passportStatLabel}>公里</Text>', 'passport km label'),
    ('                  <Text style={styles.passportStatLabel}>MISSIONS</Text>', '                  <Text style={styles.passportStatLabel}>個發現</Text>', 'passport missions label'),
    ("                  {passportLoaded ? 'LOCAL PASSPORT' : 'LOADING'}", "                  {passportLoaded ? '已儲存在手機' : '載入中'}", 'passport load state'),
    ('                        {entry.threadCode ?? entry.moodCode}', '                        {entry.threadLabel ?? entry.moodLabel}', 'passport mood label'),
    ("                        {entry.city} · {entry.minutes} 分鐘 ·{' '}\n                        {entry.contextCode ?? '—'}", '                        {entry.city} · {entry.minutes} 分鐘', 'passport card title'),
    ('                          {entry.discoveries} 個任務', '                          {entry.discoveries} 個尋找', 'passport discovery meta'),
    ('                          {selectedPassportEntry.rerouteCount} REROUTE', '                          換過 {selectedPassportEntry.rerouteCount} 次終點', 'passport reroute meta'),
    ('                      RECOVERY', '                      路上換過終點', 'passport recovery label'),
    ('                      次終點；已完成的任務都有保留。', '                      次終點；已完成的尋找都有保留。', 'passport recovery body'),
    ('                  <Text style={styles.postcardSectionLabel}>WHAT HAPPENED</Text>', '                  <Text style={styles.postcardSectionLabel}>這趟發生的事</Text>', 'passport history label'),
    ('                    {selectedPassportEntry.missions?.length ?? 0} MISSIONS', '                    {selectedPassportEntry.missions?.length ?? 0} 個尋找', 'passport mission count'),
    ("                            {mission.result === 'skipped' ? 'SKIPPED' : 'DONE'}", "                            {mission.result === 'skipped' ? '跳過' : '完成'}", 'passport mission result'),
    ('                      <Text style={styles.v38ShareMicro}>JOURNEY TICKET</Text>', '                      <Text style={styles.v38ShareMicro}>旅程票</Text>', 'share ticket micro'),
    ('                  <Text style={styles.v38ShareDestinationLabel}>DESTINATION</Text>', '                  <Text style={styles.v38ShareDestinationLabel}>終點</Text>', 'share destination label'),
    ('                      <Text style={styles.v38ShareFactLabel}>TIME</Text>', '                      <Text style={styles.v38ShareFactLabel}>時間</Text>', 'share time label'),
    ('                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.minutes} MIN</Text>', '                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.minutes} 分</Text>', 'share time value'),
    ('                      <Text style={styles.v38ShareFactLabel}>MOOD</Text>', '                      <Text style={styles.v38ShareFactLabel}>心情</Text>', 'share mood label'),
    ('                      <Text style={styles.v38ShareFactLabel}>DATE</Text>', '                      <Text style={styles.v38ShareFactLabel}>日期</Text>', 'share date label'),
    ('                    <Text style={styles.v38ShareFootText}>KEEP THIS DETOUR</Text>', '                    <Text style={styles.v38ShareFootText}>留著這張 DETOUR</Text>', 'share foot left'),
    ('                    <Text style={styles.v38ShareFootText}>{selectedPassportEntry.discoveries} QUESTS</Text>', '                    <Text style={styles.v38ShareFootText}>{selectedPassportEntry.discoveries} 個尋找</Text>', 'share foot right'),
    ("      'DETOUR JOURNEY TICKET',", "      'DETOUR 旅程票',", 'share message title'),
]
for before, after, label in passport_replacements:
    text = replace_once(text, before, after, label)

# User-facing error copy should talk about destinations, not internal Scene objects.
error_replacements = [
    ("        throw new Error('附近暫時沒有可用的 Scene。');", "        throw new Error('附近暫時沒有適合的終點。');", 'no scene error'),
    ("          '這個 Scene 太近或路線資料不足，暫時無法組成一趟 DETOUR。'", "          '這個終點太近或路線資料不足，暫時無法組成一趟 DETOUR。'", 'scene too close error'),
    ('        `${message}\\n\\n車票只有在 Scene 和步行路線都確認成功後才會發行。`', '        `${message}\\n\\n車票只有在終點和步行路線都確認成功後才會發行。`', 'ticket error detail'),
]
for before, after, label in error_replacements:
    text = replace_once(text, before, after, label)

write(path, text)


# ---------------------------------------------------------------------------
# REAL CAMERA ROUTE: keep the camera mostly visual and Chinese-first.
# ---------------------------------------------------------------------------
path = 'src/app/camera.tsx'
text = read(path)
camera_replacements = [
    ("  const missionCode = getParam(params.missionCode, 'FREE FRAME');", "  const missionCode = getParam(params.missionCode, '自由拍攝');", 'camera default mission code'),
    ("      ? `${savedCount} / ${rollCapacity} EXPOSED`\n      : `${savedCount} EXPOSED · EXTENDED`;", "      ? `${savedCount} / ${rollCapacity} 張`\n      : `${savedCount} 張`;", 'camera roll display'),
    ('        <Text style={styles.centerMessage}>LOADING CAMERA</Text>', '        <Text style={styles.centerMessage}>正在開啟相機</Text>', 'camera loading'),
    ('        <Text style={styles.permissionBrand}>DETOUR CAMERA</Text>', '        <Text style={styles.permissionBrand}>DETOUR</Text>', 'camera permission brand'),
    ("<View style={styles.rollChip}><Text style={styles.rollChipLabel}>ROLL {String(rollNumber).padStart(2, '0')}</Text><Text style={styles.rollChipCount}>{rollDisplay}</Text></View>", "<View style={styles.rollChip}><Text style={styles.rollChipLabel}>這趟照片</Text><Text style={styles.rollChipCount}>{rollDisplay}</Text></View>", 'camera roll chip'),
    ('''          <Text style={styles.promptEyebrow}>\n            {source === 'arrival'\n              ? 'FINAL FRAME'\n              : source === 'free'\n                ? 'FREE FRAME'\n                : photoRequired\n                  ? 'MISSION FRAME'\n                  : 'OPTIONAL FRAME'}{' '}\n            · {missionCode}\n          </Text>''', '''          <Text style={styles.promptEyebrow}>\n            {source === 'arrival'\n              ? '抵達'\n              : source === 'free'\n                ? '自由拍'\n                : photoRequired\n                  ? '尋找'\n                  : '紀錄'}\n          </Text>''', 'camera prompt eyebrow'),
    ("                ? 'PREVIEW ERROR'\n                : cameraReady\n                  ? 'LIVE'\n                  : 'STARTING'", "                ? '預覽錯誤'\n                : cameraReady\n                  ? '可以拍了'\n                  : '正在開啟'", 'camera status'),
    ('            <Text style={styles.exposureLabel}>NEXT FRAME</Text>', '            <Text style={styles.exposureLabel}>下一張</Text>', 'camera next frame'),
    ('            <Text style={styles.exposedLabel}>EXPOSED</Text>', '            <Text style={styles.exposedLabel}>拍好了</Text>', 'camera exposed'),
    ("                ? 'SAVED TO PHOTOS'\n                : librarySaveState === 'passport-only'\n                  ? 'PASSPORT ONLY'\n                  : 'SAVING'", "                ? '已存到照片'\n                : librarySaveState === 'passport-only'\n                  ? '只存這趟旅程'\n                  : '儲存中'", 'camera save state'),
]
for before, after, label in camera_replacements:
    text = replace_once(text, before, after, label)
write(path, text)


# ---------------------------------------------------------------------------
# Implementation status: keep important discussed-but-not-yet-built items from
# disappearing between chats/versions.
# ---------------------------------------------------------------------------
status = '''# DETOUR v0.39 — 產品收斂實作狀態\n\n> 更新：2026-09-12\n> 目的：把 `PRODUCT_FOUNDATION.md` 的決策對到程式狀態，避免「討論過但之後忘了」。\n\n## 已進入 v0.39 / v0.39.2\n\n- 15 / 30 / 45 / 60 / 90 五個時間節點。\n- 六個 Mood：隨便走 / 吃東西 / 想安靜 / 這是哪 / 色色的 / 命運。\n- Color Walk：系統抽色、不能重抽、整趟同一色、沒有一般尋找任務。\n- 一般 Mood 移除純顏色任務，改為客觀、簡單、可拍的物件 / 符號 / 數字 / 城市設施。\n- 正常旅程的尋找密度提高，Playtest 起始值約 3 / 4 / 6 / 7 / 10。\n- 導航途中持續顯示目前正在找的東西；使用者看到就能直接拍，不必等到 checkpoint 才知道題目。\n- 「吃東西」對合格候選採低承諾飲品 / 小消費約 80%、正餐約 20% 偏好。\n- 消費者介面中文優先；任務 / 抵達 / 設定 / 相機 / 收藏移除大量系統英文與 RPG 式術語。\n- AI / Playtest / 室內模擬工具從一般設定隱藏，長按「設定」才進入開發者狀態。\n- 相機保留拍照功能，但把 ROLL / EXPOSED / FRAME 等英文狀態改為簡單中文。\n\n## 已定案，但仍需繼續實作 / 實走驗證\n\n- **Route Novelty**：第二趟預設避免立即 U-turn、同街反向重走與高比例 route overlap；Scene 去重之外要做街段去重。\n- **真正的時間 budget**：目前 Engine 仍有距離模型；最終應用「步行 + 尋找 + 拍照 + 等紅燈 + 抵達」校準 15–90 分鐘。\n- **尋找節奏**：目前已讓目標一路可見，但 checkpoint / milestone 還存在；要靠實走決定何時提醒、何時自然換下一個。\n- **90 分鐘結構**：不能只是拉遠；checkpoint / 兩段式 / 弧線 / 不完整環狀仍待 Playtest。\n- **導航螢幕負擔**：要逐步利用真實 OSRM maneuver / turn steps，而不是讓使用者頻繁看手機。\n- **Scene 入口**：way / relation 的中心點不等於入口，需處理公開入口 / 可步行端點，避免把人導進建築背面或巷子。\n- **連續遊玩**：除了目的地不重複，還要讓第二、第三趟持續長出新街道。\n- **收藏長期化**：移除目前 50 趟顯示 / 儲存上限；城市也不能長期 hard-code 台北。\n\n## 不應回頭的產品規則\n\n- Detour 不是景點推薦、健身、療癒、純導航 App。\n- 真正遊戲畫面是城市；手機只負責指路、出題、記錄。\n- 一般尋找是核心玩法，不是附加 Side Quest。\n- 少看手機 ≠ 少任務。\n- 一般 Mood 不大量找顏色；Color Walk 才專一追顏色。\n- 除 `DETOUR` 品牌與必要專有名詞外，消費者介面以台灣繁體中文為預設。\n- 遊戲感來自未知、發現、路線、完成與收藏，不靠 XP / 金幣 / 排行榜，也不靠 `SIDE QUEST / MAIN QUEST` 等字樣。\n'''
write('V039_PRODUCT_CONVERGENCE.md', status)

# Build marker.
path = 'src/lib/build-info.ts'
text = read(path)
text = re.sub(r"DETOUR_BUILD_VERSION = '[^']+'", "DETOUR_BUILD_VERSION = '0.39.2'", text, count=1)
text = re.sub(
    r"v0\.39\.1: actual-duration prewarm scoring and no legacy Color Walk picker\.",
    "v0.39.2: product-language convergence, persistent Find, and denser normal-mood discovery rhythm.",
    text,
    count=1,
)
write(path, text)

print('v0.39 product convergence applied')

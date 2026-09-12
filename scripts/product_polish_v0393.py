from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new))


# --- index.tsx: mission reveal lifecycle ------------------------------------
replace_once(
    'src/app/index.tsx',
    "  const [sideMissionIndex, setSideMissionIndex] = useState(0);\n  const [traveledMeters, setTraveledMeters] = useState(0);",
    "  const [sideMissionIndex, setSideMissionIndex] = useState(0);\n  const [missionRevealedIndex, setMissionRevealedIndex] =\n    useState<number | null>(null);\n  const [traveledMeters, setTraveledMeters] = useState(0);",
)

replace_once(
    'src/app/index.tsx',
    "              <Text style={styles.ticketReadySubtitle}>\n                {selectedMood === 'color' && selectedColor\n                  ? `這趟找${selectedColor.label}。看到就拍，其他時間跟著導航走。終點繼續保密。`\n                  : '方向和路上的尋找都準備好了。終點繼續保密。'}\n              </Text>\n",
    "",
)

replace_once(
    'src/app/index.tsx',
    "            <View style={styles.detourTicketShellReady}>\n              <View style={styles.detourTicketPunchLeftTop} />",
    "            <View style={styles.detourTicketShellReady}>\n              {selectedMood === 'color' && selectedColor && (\n                <View\n                  style={{\n                    height: 8,\n                    marginTop: -1,\n                    marginHorizontal: -1,\n                    backgroundColor: selectedColor.hex,\n                  }}\n                />\n              )}\n              <View style={styles.detourTicketPunchLeftTop} />",
)

replace_once(
    'src/app/index.tsx',
    "                <Text style={styles.detourTicketReadyStamp}>\n                  路線好了\n                </Text>",
    "                <Text\n                  style={[\n                    styles.detourTicketReadyStamp,\n                    selectedMood === 'color' && selectedColor\n                      ? { color: selectedColor.hex, borderColor: selectedColor.hex }\n                      : null,\n                  ]}\n                >\n                  路線好了\n                </Text>",
)

replace_once(
    'src/app/index.tsx',
    "                  {selectedMood !== 'color' && currentMission && (\n                    <Pressable",
    "                  {selectedMood !== 'color' &&\n                    currentMission &&\n                    missionRevealedIndex === sideMissionIndex && (\n                    <Pressable",
)

replace_once(
    'src/app/index.tsx',
    "style={({ pressed }) => [{ marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 16 }, pressed && styles.v35JourneyPressed]}",
    "style={({ pressed }) => [{ marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 16 }, pressed && styles.v35JourneyPressed]}",
)

replace_once(
    'src/app/index.tsx',
    "<View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 999 }}>",
    "<View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: selectedColor.hex, borderRadius: 999 }}>",
)

replace_once(
    'src/app/index.tsx',
    "              {questPulse && <View pointerEvents=\"none\" style={styles.v35QuestPulse}><Text style={styles.v35QuestPulseText}>{questPulse === 'side' ? '還在找這個' : '到終點了'}</Text></View>}",
    "              {questPulse && <View pointerEvents=\"none\" style={styles.v35QuestPulse}><Text style={styles.v35QuestPulseText}>{questPulse === 'side' ? '新的尋找' : '到終點了'}</Text></View>}",
)

old_reach = """    const isSideQuest =
      beat.missionIndex !== undefined &&
      beat.missionIndex ===
        sideMissionIndexRef.current;

    const isFinal =
      beatIndex >=
      route.beats.length - 1;

    if (isSideQuest) {
      setQuestPulse('side');

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 620);
      });

      setQuestPulse(null);
      checkpointLockedRef.current = false;
      transitionTo('mission');
      return;
    }
"""
new_reach = """    const missionIndexAtBeat =
      beat.missionIndex;
    const isMissionReveal =
      missionIndexAtBeat !== undefined &&
      missionIndexAtBeat >=
        sideMissionIndexRef.current;

    const isFinal =
      beatIndex >=
      route.beats.length - 1;

    if (
      isMissionReveal &&
      missionIndexAtBeat !== undefined
    ) {
      const activeIndex =
        sideMissionIndexRef.current;

      if (missionIndexAtBeat > activeIndex) {
        const previousMission =
          planRef.current?.sideMissions[
            activeIndex
          ];

        if (
          previousMission &&
          !missionResultsRef.current[
            previousMission.id
          ]
        ) {
          recordMissionResult(
            previousMission,
            'skipped'
          );
        }

        sideMissionIndexRef.current =
          missionIndexAtBeat;
        setSideMissionIndex(
          missionIndexAtBeat
        );
      }

      setMissionRevealedIndex(null);
      setQuestPulse('side');

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 420);
      });

      setQuestPulse(null);
      checkpointLockedRef.current = false;
      transitionTo('mission');
      return;
    }
"""
replace_once('src/app/index.tsx', old_reach, new_reach)

insert_before_advance = """  async function advanceAfterSideMission() {
"""
new_before_advance = """  async function beginCurrentMissionSearch() {
    const route = navigationRouteRef.current;
    if (!route || !currentMission) return;

    await Haptics.selectionAsync();

    const missionIndex =
      sideMissionIndexRef.current;
    const beatIndex =
      navigationBeatIndexRef.current;

    setMissionRevealedIndex(
      missionIndex
    );

    transitionTo('journey', () => {
      if (
        beatIndex <
        route.beats.length - 1
      ) {
        setBeat(beatIndex + 1);
      }
    });
  }

  async function advanceAfterSideMission() {
"""
replace_once('src/app/index.tsx', insert_before_advance, new_before_advance)

old_advance = """  async function advanceAfterSideMission() {
    if (!plan || !navigationRoute) return;

    const nextMissionIndex = sideMissionIndex + 1;
    sideMissionIndexRef.current = nextMissionIndex;

    const beatIndex = navigationBeatIndexRef.current;

    if (beatIndex >= navigationRoute.beats.length - 1) {
      transitionTo('arrival', () => {
        setSideMissionIndex(nextMissionIndex);
      });
      return;
    }

    transitionTo('journey', () => {
      setSideMissionIndex(nextMissionIndex);
      setBeat(beatIndex + 1);
    });
  }
"""
new_advance = """  async function advanceAfterSideMission() {
    if (!plan || !navigationRoute) return;

    const nextMissionIndex =
      sideMissionIndexRef.current + 1;
    sideMissionIndexRef.current =
      nextMissionIndex;
    setMissionRevealedIndex(null);

    const beatIndex =
      navigationBeatIndexRef.current;
    const shouldAdvanceBeat =
      stageRef.current === 'mission';

    if (
      beatIndex >=
      navigationRoute.beats.length - 1
    ) {
      transitionTo('arrival', () => {
        setSideMissionIndex(
          nextMissionIndex
        );
      });
      return;
    }

    transitionTo('journey', () => {
      setSideMissionIndex(
        nextMissionIndex
      );

      if (shouldAdvanceBeat) {
        setBeat(beatIndex + 1);
      }
    });
  }
"""
replace_once('src/app/index.tsx', old_advance, new_advance)

replace_all(
    'src/app/index.tsx',
    "      setSideMissionIndex(0);\n      sideMissionIndexRef.current = 0;",
    "      setSideMissionIndex(0);\n      sideMissionIndexRef.current = 0;\n      setMissionRevealedIndex(null);",
)

replace_once(
    'src/app/index.tsx',
    "    await startHeadingWatcher();\n\n    transitionTo('journey');",
    "    await startHeadingWatcher();\n\n    setMissionRevealedIndex(null);\n    transitionTo('journey');",
)

old_mission_copy = """              <Text style={styles.fieldEventInstruction}>
                {currentMission.instruction}
              </Text>


              {plan.context !== 'day' && (
                <Text style={styles.fieldEventContextNote}>
                  {plan.contextNote}
                </Text>
              )}
"""
new_mission_copy = """              {plan.context !== 'day' && (
                <Text style={styles.fieldEventContextNote}>
                  留在有照明、公開可走的位置。
                </Text>
              )}
"""
replace_once('src/app/index.tsx', old_mission_copy, new_mission_copy)

old_mission_actions = """            <View style={styles.fieldEventBottom}>
              {currentMission.photo ? (
                <>
                  <Pressable
                    onPress={() => openCamera('side')}
                    style={({ pressed }) => [
                      styles.fieldEventPrimary,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventPrimaryText}>
                      拍下來
                    </Text>
                    <Text style={styles.fieldEventPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={skipCurrentRequiredMission}
                    style={({ pressed }) => [
                      styles.fieldEventSkip,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventSkipText}>
                      找不到，先跳過
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.fieldEventActions}>
                  <Pressable
                    onPress={completeSideMissionWithoutPhoto}
                    style={({ pressed }) => [
                      styles.fieldEventPrimary,
                      styles.fieldEventPrimaryFlexible,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventPrimaryText}>
                      完成
                    </Text>
                    <Text style={styles.fieldEventPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openCamera('side')}
                    accessibilityLabel=\"拍一張照片\"
                    style={({ pressed }) => [
                      styles.fieldEventCamera,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventCameraIcon}>
                      📷
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
"""
new_mission_actions = """            <View style={styles.fieldEventBottom}>
              <Pressable
                onPress={beginCurrentMissionSearch}
                style={({ pressed }) => [
                  styles.fieldEventPrimary,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.fieldEventPrimaryText}>
                  開始找
                </Text>
                <Text style={styles.fieldEventPrimaryArrow}>
                  →
                </Text>
              </Pressable>

              <Pressable
                onPress={skipCurrentRequiredMission}
                style={({ pressed }) => [
                  styles.fieldEventSkip,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.fieldEventSkipText}>
                  這個先跳過
                </Text>
              </Pressable>
            </View>
"""
replace_once('src/app/index.tsx', old_mission_actions, new_mission_actions)

# Don't pass camera-only metadata that the simplified camera no longer renders.
replace_once(
    'src/app/index.tsx',
    "        missionTitle: missionForCamera.title,\n        missionCompletion: missionForCamera.completion,\n        photoRequired: missionForCamera.photo ? '1' : '0',\n        savedCount: String(photos.length),\n        rollCapacity: String(rollCapacity),\n        rollNumber: String(passport.length + 1),",
    "        missionTitle: missionForCamera.title,\n        savedCount: String(photos.length),\n        rollCapacity: String(rollCapacity),",
)

# --- camera.tsx: make the camera feel like a camera --------------------------
replace_once(
    'src/app/camera.tsx',
    "  const [librarySaveState, setLibrarySaveState] = useState<\n    'idle' | 'saved' | 'passport-only'\n  >('idle');\n",
    "",
)

replace_once(
    'src/app/camera.tsx',
    "  const missionCompletion = getParam(\n    params.missionCompletion,\n    '拍或不拍都不影響主線。'\n  );\n  const photoRequired = getParam(params.photoRequired, '0') === '1';\n",
    "",
)

replace_once(
    'src/app/camera.tsx',
    "  const rollNumber =\n    Number.parseInt(getParam(params.rollNumber, '1'), 10) || 1;\n\n  const nextExposure = savedCount + 1;\n  const rollDisplay =\n    savedCount <= rollCapacity\n      ? `${savedCount} / ${rollCapacity} 張`\n      : `${savedCount} 張`;\n",
    "",
)

replace_once(
    'src/app/camera.tsx',
    "      setLibrarySaveState(savedToLibrary ? 'saved' : 'passport-only');\n",
    "",
)
replace_once(
    'src/app/camera.tsx',
    "      setLibrarySaveState('idle');\n",
    "",
)

replace_once(
    'src/app/camera.tsx',
    "          <View style={styles.cameraTopLeft}><Pressable onPress={() => router.back()} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable><View style={styles.rollChip}><Text style={styles.rollChipLabel}>這趟照片</Text><Text style={styles.rollChipCount}>{rollDisplay}</Text></View></View>",
    "          <View style={styles.cameraTopLeft}><Pressable onPress={() => router.back()} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>",
)

old_prompt = """        <View style={styles.promptCard}>
          <Text style={styles.promptEyebrow}>
            {source === 'arrival'
              ? '抵達'
              : source === 'free'
                ? '自由拍'
                : photoRequired
                  ? '尋找'
                  : '紀錄'}
          </Text>

          <Text style={styles.promptTitle}>{missionTitle}</Text>

          <Text style={styles.promptRule}>
            {source === 'free'
              ? '自由拍攝。按下快門就收進這趟底片，不會推進任務。'
              : photoRequired
                ? '這格就是完成條件。按下快門後直接回到旅程。'
                : `${missionCompletion} 這張只是一個額外紀錄。`}
          </Text>
        </View>
"""
new_prompt = """        <View style={styles.promptCard}>
          <View style={styles.promptDot} />
          <Text
            numberOfLines={2}
            style={styles.promptTitle}
          >
            {missionTitle}
          </Text>
        </View>
"""
replace_once('src/app/camera.tsx', old_prompt, new_prompt)

old_camera_bottom = """          <View style={styles.cameraBottom}>
          <View style={styles.statusColumn}>
            <Text style={styles.statusText}>
              {mountError
                ? '預覽錯誤'
                : cameraReady
                  ? '可以拍了'
                  : '正在開啟'}
            </Text>

            {mountError && (
              <Text style={styles.errorText}>{mountError}</Text>
            )}
          </View>

          <Pressable
            disabled={!cameraReady || takingPhoto}
            onPress={takePhoto}
            style={({ pressed }) => [
              styles.shutterOuter,
              (!cameraReady || takingPhoto) && styles.shutterDisabled,
              pressed && styles.shutterPressed,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <View style={styles.exposureColumn}>
            <Text style={styles.exposureNext}>
              {nextExposure <= rollCapacity
                ? `${String(nextExposure).padStart(2, '0')} / ${String(
                    rollCapacity
                  ).padStart(2, '0')}`
                : `+${nextExposure - rollCapacity}`}
            </Text>
            <Text style={styles.exposureLabel}>下一張</Text>
          </View>
          </View>
"""
new_camera_bottom = """          <View style={styles.cameraBottom}>
            <View style={styles.statusColumn}>
              <Text style={styles.statusText}>
                {savedCount} / {rollCapacity}
              </Text>
              <Text style={styles.exposureLabel}>這趟照片</Text>
            </View>

            <Pressable
              disabled={!cameraReady || takingPhoto}
              onPress={takePhoto}
              style={({ pressed }) => [
                styles.shutterOuter,
                (!cameraReady || takingPhoto) && styles.shutterDisabled,
                pressed && styles.shutterPressed,
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <View style={styles.exposureColumn}>
              {mountError ? (
                <Text style={styles.errorText}>預覽錯誤</Text>
              ) : (
                <Text style={styles.statusText}>
                  {cameraReady ? '可以拍了' : '正在開啟'}
                </Text>
              )}
            </View>
          </View>
"""
replace_once('src/app/camera.tsx', old_camera_bottom, new_camera_bottom)

old_exposed = """          <View style={styles.exposedCard}>
            <View style={styles.exposedDot} />
            <Text style={styles.exposedLabel}>拍好了</Text>
            <Text style={styles.exposedCount}>
              {nextExposure <= rollCapacity
                ? `${String(nextExposure).padStart(2, '0')} / ${String(
                    rollCapacity
                  ).padStart(2, '0')}`
                : `${nextExposure}`}
            </Text>
            <Text style={styles.exposedSaveState}>
              {librarySaveState === 'saved'
                ? '已存到照片'
                : librarySaveState === 'passport-only'
                  ? '只存這趟旅程'
                  : '儲存中'}
            </Text>
          </View>
"""
new_exposed = """          <View style={styles.exposedCard}>
            <View style={styles.exposedDot} />
            <Text style={styles.exposedLabel}>拍好了</Text>
          </View>
"""
replace_once('src/app/camera.tsx', old_exposed, new_exposed)

replace_once(
    'src/app/camera.tsx',
    "  promptCard: {\n    alignSelf: 'stretch',\n    backgroundColor: 'rgba(17,17,15,0.8)',\n    padding: 16,\n  },\n\n  promptEyebrow: {\n    fontSize: 8,\n    letterSpacing: 1.7,\n    color: SIGNAL,\n    marginBottom: 10,\n  },\n\n  promptTitle: {\n    fontSize: 19,\n    lineHeight: 25,\n    fontWeight: '700',\n    color: BONE,\n  },\n\n  promptRule: {\n    marginTop: 8,\n    fontSize: 11,\n    lineHeight: 18,\n    color: MUTED,\n  },",
    "  promptCard: {\n    alignSelf: 'center',\n    maxWidth: '88%',\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: 10,\n    backgroundColor: 'rgba(17,17,15,0.78)',\n    paddingHorizontal: 14,\n    paddingVertical: 11,\n    borderRadius: 18,\n  },\n\n  promptDot: {\n    width: 7,\n    height: 7,\n    borderRadius: 4,\n    backgroundColor: SIGNAL,\n  },\n\n  promptTitle: {\n    flexShrink: 1,\n    fontSize: 15,\n    lineHeight: 20,\n    fontWeight: '700',\n    color: BONE,\n  },",
)

replace_once(
    'src/app/camera.tsx',
    "    minWidth: 180,\n    paddingVertical: 24,\n    paddingHorizontal: 28,",
    "    minWidth: 132,\n    paddingVertical: 18,\n    paddingHorizontal: 24,",
)

# --- journey-engine: remove reading-comprehension-style mission -------------
movement_block = """    {
      code: 'MOVEMENT',
      title: '找一個不是你造成的移動。',
      instruction:
        '人、車、風吹的葉子、水、影子都可以。不要追它，只要在原本的路上找到。',
      completion: '看著它連續移動五秒，就完成。',
      photo: false,
      portable: true,
    },
"""
replace_once('src/lib/journey-engine.ts', movement_block, '')

# --- product docs ------------------------------------------------------------
foundation_marker = """8. **Color Walk 是唯一例外。**
   - 「色色的」沒有一般尋找任務；整趟唯一規則就是追同一個隨機顏色。
   - 一般 Mood 不得用大量純顏色題目稀釋 Color Walk 的辨識度。

### 一般 Mood 的尋找密度方向
"""
foundation_replacement = """8. **Color Walk 是唯一例外。**
   - 「色色的」沒有一般尋找任務；整趟唯一規則就是追同一個隨機顏色。
   - 一般 Mood 不得用大量純顏色題目稀釋 Color Walk 的辨識度。

9. **尋找題目要是「看東西」，不是「讀題目」。**
   - 題目最好是名詞先行：機車、箭頭、三角形、數字、貼紙、人孔蓋。
   - 如果使用者需要先解析因果、比較、抽象條件或語意陷阱，題目就太像閱讀理解。
   - 「找一個不是你造成的移動」這類句型不採用；它要求先理解條件，再觀察世界。
   - 判斷標準：一秒看懂要找什麼，收起手機還記得。

10. **車票與 Color Walk 的顏色有固定語意。**
   - 橘色仍代表 DETOUR 系統 / 行動色。
   - Color Walk 抽到的顏色只用在本趟題目的局部提示，例如票面色帶、印章、顏色 chip。
   - 不把導航箭頭、主要 CTA 或整套 UI 全部染成抽到的顏色，避免把「任務色」誤認成系統狀態。
   - 車票外不要重複一遍票內已經寫過的規則；票本身就是說明。

11. **尋找先揭曉，再留在導航裡。**
   - 正式揭曉前，導航不能先偷顯示題目內容。
   - 到達尋找節點時先用乾淨的大畫面揭曉「這段路找什麼」。
   - 使用者按「開始找」回到導航後，才顯示精簡 reminder；看到就拍。
   - 下一個尋找節點到來時，如果上一個仍沒找到，可以自然略過，不讓使用者為任務折返。

### 一般 Mood 的尋找密度方向
"""
replace_once('PRODUCT_FOUNDATION.md', foundation_marker, foundation_replacement)

status_marker = """- 相機保留拍照功能，但把 ROLL / EXPOSED / FRAME 等英文狀態改為簡單中文。
"""
status_replacement = """- 相機保留拍照功能，但把 ROLL / EXPOSED / FRAME 等英文狀態改為簡單中文。
- v0.39.3：車票外移除重複說明；Color Walk 車票用抽到的顏色做局部色帶 / 印章，但 DETOUR 系統操作色仍維持橘色。
- v0.39.3：尋找內容不再在正式揭曉前出現在導航；揭曉後才留下精簡 reminder。
- v0.39.3：相機再減一層資訊，只保留控制、簡短目前目標、張數與快門。
- 「找一個不是你造成的移動」這類需要先解析條件的閱讀理解式題目列入禁止方向。
"""
replace_once('V039_PRODUCT_CONVERGENCE.md', status_marker, status_replacement)

# Current trigger implementation note: route-progress beats, not a fixed timer.
status_marker_2 = """- **尋找節奏**：目前已讓目標一路可見，但 checkpoint / milestone 還存在；要靠實走決定何時提醒、何時自然換下一個。
"""
status_replacement_2 = """- **尋找節奏**：目前不是固定每 N 分鐘觸發；Navigation Engine 會把尋找平均分散在 route beat / 路程進度上。v0.39.3 改成到節點才揭曉，之後 reminder 持續到找到或下一個尋找節點。仍需靠實走決定各時間尺度的最佳密度。
"""
replace_once('V039_PRODUCT_CONVERGENCE.md', status_marker_2, status_replacement_2)

replace_once(
    'src/lib/build-info.ts',
    "// v0.39.2: product-language convergence, persistent Find, and denser normal-mood discovery rhythm.\nexport const DETOUR_BUILD_VERSION = '0.39.2';",
    "// v0.39.3: ticket cleanup, Color Walk accent semantics, staged Find reveal, and a quieter camera.\nexport const DETOUR_BUILD_VERSION = '0.39.3';",
)

print('Applied DETOUR v0.39.3 field-test polish')

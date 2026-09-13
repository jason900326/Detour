from pathlib import Path
import re

INDEX = Path('src/app/index.tsx')
BUILD = Path('src/lib/build-info.ts')
text = INDEX.read_text(encoding='utf-8')

# Modal for a centered, unmistakable retry state.
old_import = "  Image,\n  PanResponder,"
new_import = "  Image,\n  Modal,\n  PanResponder,"
if old_import not in text:
    raise SystemExit('react-native import anchor not found')
text = text.replace(old_import, new_import, 1)

# Make the printer one physical assembly: metal slot, then one ticket moving downward
# with its bottom edge/barcode leading. Also add a back button and a centered retry modal.
pattern = re.compile(
    r"        \{stage === 'preparing' && \(\n.*?\n        \{stage === 'ready' && \(",
    re.S,
)
replacement = r"""        {stage === 'preparing' && (
          <View style={styles.v45PrintingScreen}>
            <View style={styles.v48PrintingTopBar}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v48PrintingBack}>
                <Text style={styles.v48PrintingBackText}>‹</Text>
              </Pressable>
              <Text style={styles.v45PrintingBrand}>DETOUR</Text>
            </View>

            <View style={[styles.v45PrintingTitleWrap, styles.v48PrintingTitleWrap]}>
              <Text style={styles.v45PrintingTitle}>正在印製車票…</Text>
              <DetourAccentStroke width={180} style={styles.v45PrintingUnderline} />
            </View>

            <View style={styles.v48PrinterAssembly}>
              <Image
                source={require('../../assets/detour/printer-front.png')}
                style={styles.v48PrinterBase}
                resizeMode="contain"
              />

              <View style={styles.v48PaperViewport} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-326, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                  />
                </Animated.View>
              </View>

              <View pointerEvents="none" style={styles.v48PrinterLipMask}>
                <Image
                  source={require('../../assets/detour/printer-front.png')}
                  style={styles.v48PrinterMaskImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Modal
              visible={Boolean(ticketBuildError)}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={goBack}
            >
              <View style={styles.v48RetryOverlay}>
                <View style={styles.v48RetryCard}>
                  <Text style={styles.v48RetryEyebrow}>出票失敗</Text>
                  <Text style={styles.v48RetryTitle}>這張票卡住了。</Text>
                  <Text style={styles.v48RetryBody}>{ticketBuildError}</Text>
                  <Pressable
                    onPress={() => {
                      routeProgress.setValue(0.04);
                      setTicketBuildError(null);
                      setTicketBuildStatus('再試一次…');
                      void prepareDetourTicket();
                    }}
                    style={({ pressed }) => [
                      styles.v48RetryPrimary,
                      pressed && styles.v45MoodCardPressed,
                    ]}
                  >
                    <Text style={styles.v48RetryPrimaryText}>再試一次</Text>
                    <Text style={styles.v48RetryPrimaryArrow}>→</Text>
                  </Pressable>
                  <Pressable onPress={goBack} style={styles.v48RetrySecondary}>
                    <Text style={styles.v48RetrySecondaryText}>返回選心情</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </View>
        )}

        {stage === 'ready' && ("""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'preparing block replacement count={count}')

# Edge-swipe back: only on screens where going back is safe and non-destructive.
back_anchor = """    if (stage === 'finish') {
      resetDetour();
    }
  }

  function remainingDetourMinutes() {"""
back_insert = """    if (stage === 'finish') {
      resetDetour();
    }
  }

  const edgeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          const safeBackStages: Stage[] = [
            'onboarding',
            'settings',
            'mood',
            'preparing',
            'ready',
            'sceneIssue',
            'passport',
            'passportDetail',
          ];

          if (!safeBackStages.includes(stage)) return false;
          if (
            stage === 'onboarding' &&
            onboardingStep === 0 &&
            !onboardingFromSettings
          ) {
            return false;
          }

          const horizontalEnough =
            gestureState.dx > 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35;

          return gestureState.x0 <= 30 && horizontalEnough;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= 72 && gestureState.vx > 0.12) {
            void Haptics.selectionAsync();
            goBack();
          }
        },
      }),
    [stage, onboardingStep, onboardingFromSettings]
  );

  function remainingDetourMinutes() {"""
if back_anchor not in text:
    raise SystemExit('goBack insertion anchor not found')
text = text.replace(back_anchor, back_insert, 1)

# Attach the edge gesture at the shared page root so all supported pages behave consistently.
root_anchor = """      <Animated.View
        style={["""
root_replace = """      <Animated.View
        {...edgeBackResponder.panHandlers}
        style={["""
if root_anchor not in text:
    raise SystemExit('animated root anchor not found')
text = text.replace(root_anchor, root_replace, 1)

# New v0.46.2 styles. Keep old printer styles untouched for easy rollback; these are the only ones used now.
style_anchor = "const styles = StyleSheet.create({\n"
styles = r"""const styles = StyleSheet.create({
  v48PrintingTopBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v48PrintingBack: {
    width: 42,
    height: 48,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  v48PrintingBackText: {
    fontSize: 38,
    lineHeight: 42,
    color: INK,
  },
  v48PrintingTitleWrap: {
    marginTop: 48,
  },
  v48PrinterAssembly: {
    width: '100%',
    height: 456,
    marginTop: 18,
    position: 'relative',
    alignItems: 'center',
  },
  v48PrinterBase: {
    position: 'absolute',
    top: 0,
    width: '100%',
    aspectRatio: 2048 / 682,
    zIndex: 1,
  },
  v48PaperViewport: {
    position: 'absolute',
    top: 58,
    width: 310,
    height: 398,
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
  },
  v48PaperTrack: {
    position: 'absolute',
    top: 0,
    width: 310,
    alignItems: 'center',
  },
  v48PrinterLipMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 74,
    overflow: 'hidden',
    zIndex: 4,
  },
  v48PrinterMaskImage: {
    position: 'absolute',
    top: 0,
    width: '100%',
    aspectRatio: 2048 / 682,
  },
  v48RetryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,15,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  v48RetryCard: {
    width: '100%',
    maxWidth: 370,
    borderRadius: 24,
    backgroundColor: '#FFF9F1',
    borderWidth: 1,
    borderColor: SIGNAL,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  v48RetryEyebrow: {
    fontSize: 14,
    fontWeight: '900',
    color: SIGNAL,
  },
  v48RetryTitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
  },
  v48RetryBody: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    color: INK,
  },
  v48RetryPrimary: {
    marginTop: 24,
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: INK,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v48RetryPrimaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: BONE,
  },
  v48RetryPrimaryArrow: {
    fontSize: 30,
    color: SIGNAL,
  },
  v48RetrySecondary: {
    minHeight: 48,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v48RetrySecondaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: MUTED,
  },
"""
if style_anchor not in text:
    raise SystemExit('style anchor not found')
text = text.replace(style_anchor, styles, 1)

INDEX.write_text(text, encoding='utf-8')

build = BUILD.read_text(encoding='utf-8')
build = re.sub(
    r"// v0\.46\.1:.*\nexport const DETOUR_BUILD_VERSION = '0\.46\.1';",
    "// v0.46.2: physical bottom-first ticket printer, centered retry modal, and edge-swipe back.\nexport const DETOUR_BUILD_VERSION = '0.46.2';",
    build,
    count=1,
)
if "DETOUR_BUILD_VERSION = '0.46.2'" not in build:
    raise SystemExit('build marker update failed')
BUILD.write_text(build, encoding='utf-8')

print('v0.46.2 migration applied')

from pathlib import Path

controller_path = Path('src/hooks/use-detour-home-controller.ts')
controller = controller_path.read_text()

controller = controller.replace('    routeProgress.setValue(0.04);', '    routeProgress.setValue(0);', 1)

start = controller.index('  function advanceTicketProgress(')
end = controller.index('\n  function animateIn()', start)
controller = (
    controller[:start]
    + """  function advanceTicketProgress(\n    _toValue: number,\n    status: string\n  ) {\n    // Route/data preparation and physical paper movement are separate.\n    // The ticket must stay fully inside the printer until the route is ready.\n    setTicketBuildStatus(status);\n  }\n"""
    + controller[end:]
)

controller = controller.replace('      const minimumPrintMs = 1850;', '      const minimumPrintMs = 650;', 1)
controller = controller.replace(
    """        Animated.timing(routeProgress, {\n          toValue: 1,\n          duration: 360,\n          easing: Easing.out(Easing.cubic),\n          useNativeDriver: false,\n        }).start(() => resolve());""",
    """        Animated.timing(routeProgress, {\n          toValue: 1,\n          duration: 1100,\n          easing: Easing.inOut(Easing.quad),\n          useNativeDriver: false,\n        }).start(() => resolve());""",
    1,
)
controller = controller.replace(
    "      transitionTo('ready');\n\n      // Arrival copy",
    "      // Keep the exact same printer/ticket tree mounted while the stamp lands.\n      // A normal screen transition would make the freshly printed ticket jump.\n      setStage('ready');\n\n      // Arrival copy",
    1,
)
controller_path.write_text(controller)

view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text()
start = view.index("        {stage === 'preparing' && (")
end = view.index("        {stage === 'journey' &&", start)
printer_block = r'''        {(stage === 'preparing' || stage === 'ready') && (
          <View style={styles.v45PrintingScreen}>
            <View style={styles.v48PrintingTopBar}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v48PrintingBack}>
                <Text style={styles.v48PrintingBackText}>‹</Text>
              </Pressable>
              <Text style={styles.v45PrintingBrand}>DETOUR</Text>
            </View>

            <View style={[styles.v45PrintingTitleWrap, styles.v48PrintingTitleWrap]}>
              <Text style={styles.v45PrintingTitle}>
                {stage === 'ready' ? '車票完成' : '正在印製車票…'}
              </Text>
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
                            outputRange: [-420, 0],
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
                    stamped={stage === 'ready'}
                    stampProgress={ticketStamp}
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

            {stage === 'ready' && ticketReadyUnlocked && (
              <Pressable
                onPress={startDetour}
                style={({ pressed }) => [
                  styles.v48DepartButton,
                  pressed && styles.v48DepartButtonPressed,
                ]}
              >
                <Text style={styles.v48DepartButtonText}>出發</Text>
                <Text style={styles.v48DepartButtonArrow}>→</Text>
              </Pressable>
            )}

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
                      routeProgress.setValue(0);
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

'''
view = view[:start] + printer_block + view[end:]
view_path.write_text(view)

styles_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = styles_path.read_text()
marker = "  v48RetryOverlay: {"
insert = """  v48DepartButton: {\n    position: 'absolute',\n    left: 30,\n    right: 30,\n    bottom: 24,\n    minHeight: 68,\n    borderRadius: 34,\n    backgroundColor: INK,\n    paddingHorizontal: 24,\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'space-between',\n    zIndex: 10,\n    shadowColor: '#000',\n    shadowOpacity: 0.18,\n    shadowRadius: 14,\n    shadowOffset: { width: 0, height: 8 },\n    elevation: 8,\n  },\n  v48DepartButtonPressed: {\n    transform: [{ translateY: 1 }],\n    opacity: 0.9,\n  },\n  v48DepartButtonText: {\n    fontSize: 24,\n    fontWeight: '900',\n    color: BONE,\n  },\n  v48DepartButtonArrow: {\n    fontSize: 32,\n    color: SIGNAL,\n  },\n"""
if insert not in styles:
    styles = styles.replace(marker, insert + marker, 1)
styles_path.write_text(styles)

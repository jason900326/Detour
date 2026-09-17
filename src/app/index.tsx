import { useCallback, useEffect, useRef } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';

import { ArrivalCompletionStage } from '../components/arrival-completion-stage';
import { DetourHomeView } from '../components/detour-home-view';
import {
  PrinterPhysicalHaptics,
  useJourneyStageMotion,
  usePhysicalController,
} from '../components/physical-motion';
import { SideEventPaper } from '../components/side-event-paper';
import {
  SlowDestinationPicker,
  type SlowDestinationChoice,
} from '../components/slow-destination-picker';
import { TicketTearProvider } from '../components/ticket-tear-context';
import { useDetourHomeController } from '../hooks/use-detour-home-controller';

export default function HomeScreen() {
  const controller = useDetourHomeController();
  const { width, height } = useWindowDimensions();
  const shellScale = useRef(new Animated.Value(1)).current;
  const stageX = useJourneyStageMotion(controller.stage);
  const motionController = usePhysicalController(controller, shellScale);
  const pendingSlowStartRef = useRef<{
    destination: string;
    latitude: number;
    longitude: number;
    minutes: number;
  } | null>(null);
  const tearEnabled =
    controller.stage === 'ready' && controller.ticketReadyUnlocked;
  const slowPickerVisible =
    controller.stage === 'mood' && controller.selectedMood === 'slow';
  const discoveryPaperVisible =
    controller.stage === 'journey' &&
    controller.selectedMood !== 'color' &&
    Boolean(controller.activeSideEvent) &&
    !controller.showNextBeatMap;

  const handleTicketTorn = useCallback(() => {
    void motionController.startDetour();
  }, [motionController]);

  useEffect(() => {
    const pending = pendingSlowStartRef.current;
    if (!pending) return;

    if (
      controller.stage !== 'mood' ||
      controller.selectedMood !== 'slow'
    ) {
      pendingSlowStartRef.current = null;
      return;
    }

    if (
      controller.slowDestinationInput !== pending.destination ||
      controller.selectedMinutes !== pending.minutes ||
      controller.slowDestinationPoint?.latitude !== pending.latitude ||
      controller.slowDestinationPoint?.longitude !== pending.longitude
    ) {
      return;
    }

    pendingSlowStartRef.current = null;
    void controller.continueFromMood();
  }, [
    controller.continueFromMood,
    controller.selectedMinutes,
    controller.selectedMood,
    controller.slowDestinationInput,
    controller.slowDestinationPoint,
    controller.stage,
  ]);

  const confirmSlowDestination = useCallback(
    (choice: SlowDestinationChoice, minutes: number) => {
      const normalizedMinutes = Math.max(10, Math.min(60, minutes));
      pendingSlowStartRef.current = {
        destination: choice.label,
        latitude: choice.latitude,
        longitude: choice.longitude,
        minutes: normalizedMinutes,
      };
      controller.setSlowDestinationError(null);
      controller.setSlowDestinationLabel(choice.label);
      controller.setSlowDestinationPoint({
        latitude: choice.latitude,
        longitude: choice.longitude,
      });
      controller.setSlowDestinationInput(choice.label);
      controller.setSelectedTime(String(normalizedMinutes));
      controller.setSliderDisplayMinutes(normalizedMinutes);
    },
    [controller]
  );

  const dismissSlowDestination = useCallback(() => {
    pendingSlowStartRef.current = null;
    controller.setSlowDestinationInput('');
    controller.setSlowDestinationLabel('');
    controller.setSlowDestinationPoint(null);
    controller.setSlowDestinationError(null);
    controller.setSelectedMood(null);
  }, [controller]);

  // During the ready-to-tear state the horizontal gesture belongs to the
  // ticket, not to the page-level back swipe. The visible back button still
  // works normally.
  const baseViewController = tearEnabled
    ? ({
        ...motionController,
        ticketReadyUnlocked: false,
        edgeBackResponder: {
          panHandlers: {},
        } as typeof motionController.edgeBackResponder,
      } as typeof motionController)
    : motionController;

  // The legacy slow-mood modal only accepted a literal geocoder string. Hide
  // it while the new branch-aware picker is active; the real controller still
  // keeps selectedMood='slow' so the journey pipeline remains unchanged.
  const viewController = slowPickerVisible
    ? ({
        ...baseViewController,
        selectedMood: null,
      } as typeof baseViewController)
    : baseViewController;

  return (
    <TicketTearProvider enabled={tearEnabled} onTorn={handleTicketTorn}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: stageX }, { scale: shellScale }],
        }}
      >
        <DetourHomeView controller={viewController} />
        <PrinterPhysicalHaptics controller={controller} />

        <ArrivalCompletionStage
          controller={motionController}
          width={width}
          height={height}
        />

        <SlowDestinationPicker
          visible={slowPickerVisible}
          selectedMinutes={controller.selectedMinutes}
          onDismiss={dismissSlowDestination}
          onConfirm={confirmSlowDestination}
        />

        {discoveryPaperVisible && controller.activeSideEvent && (
          <SideEventPaper
            event={controller.activeSideEvent}
            onReplace={controller.replaceActiveSideEvent}
            devMode={controller.devMode}
          />
        )}

        {tearEnabled && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              bottom: 37,
              alignItems: 'center',
              zIndex: 20,
            }}
          >
            <View
              style={{
                width: 28,
                height: 1,
                marginBottom: 10,
                backgroundColor: '#C1BCB2',
              }}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: 0.3,
                color: '#77736B',
              }}
            >
              沿齒孔撕過中線，開始旅程
            </Text>
          </View>
        )}
      </Animated.View>
    </TicketTearProvider>
  );
}

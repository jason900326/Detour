import { useCallback, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { DetourHomeView } from '../components/detour-home-view';
import {
  PrinterPhysicalHaptics,
  useJourneyStageMotion,
  usePhysicalController,
} from '../components/physical-motion';
import { TicketTearProvider } from '../components/ticket-tear-context';
import { useDetourHomeController } from '../hooks/use-detour-home-controller';

export default function HomeScreen() {
  const controller = useDetourHomeController();
  const shellScale = useRef(new Animated.Value(1)).current;
  const stageX = useJourneyStageMotion(controller.stage);
  const motionController = usePhysicalController(controller, shellScale);
  const tearEnabled =
    controller.stage === 'ready' && controller.ticketReadyUnlocked;

  const handleTicketTorn = useCallback(() => {
    void motionController.startDetour();
  }, [motionController]);

  // DetourHomeView still contains the legacy ready CTA. During the tear-ready
  // state we only mask that one flag; the printed V45Ticket itself stays in the
  // exact same React tree from preparing through ready.
  const viewController = tearEnabled
    ? ({ ...motionController, ticketReadyUnlocked: false } as typeof motionController)
    : motionController;

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
              沿齒孔滑開票根，開始旅程
            </Text>
          </View>
        )}
      </Animated.View>
    </TicketTearProvider>
  );
}

import { useCallback, useRef } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';

import { ArrivalCompletionStage } from '../components/arrival-completion-stage';
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
  const { width, height } = useWindowDimensions();
  const shellScale = useRef(new Animated.Value(1)).current;
  const stageX = useJourneyStageMotion(controller.stage);
  const motionController = usePhysicalController(controller, shellScale);
  const tearEnabled =
    controller.stage === 'ready' && controller.ticketReadyUnlocked;

  const handleTicketTorn = useCallback(() => {
    void motionController.startDetour();
  }, [motionController]);

  // During the ready-to-tear state the horizontal gesture belongs to the
  // ticket, not to the page-level back swipe. The visible back button still
  // works normally.
  const viewController = tearEnabled
    ? ({
        ...motionController,
        ticketReadyUnlocked: false,
        edgeBackResponder: {
          panHandlers: {},
        } as typeof motionController.edgeBackResponder,
      } as typeof motionController)
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

        <ArrivalCompletionStage
          controller={motionController}
          width={width}
          height={height}
        />

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

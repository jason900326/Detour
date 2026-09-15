import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

import { DetourHomeView } from '../components/detour-home-view';
import { FreeformTicketTearPrototype } from '../components/freeform-ticket-tear-prototype';
import {
  PrinterPhysicalHaptics,
  useJourneyStageMotion,
  usePhysicalController,
} from '../components/physical-motion';
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

  // Keep the experiment isolated from the production ready screen. This also
  // removes the page-level swipe-back responder while the user is tearing, so
  // the horizontal gesture belongs entirely to the ticket.
  if (tearEnabled) {
    return (
      <FreeformTicketTearPrototype
        onBack={controller.goBack}
        onTorn={handleTicketTorn}
      />
    );
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateX: stageX }, { scale: shellScale }],
      }}
    >
      <DetourHomeView controller={motionController} />
      <PrinterPhysicalHaptics controller={controller} />
    </Animated.View>
  );
}

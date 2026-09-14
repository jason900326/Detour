import { useRef } from 'react';
import { Animated } from 'react-native';

import { DetourHomeView } from '../components/detour-home-view';
import {
  PrinterPhysicalHaptics,
  ReadyTicketTearOverlay,
  useJourneyStageMotion,
  usePhysicalController,
} from '../components/physical-motion';
import { useDetourHomeController } from '../hooks/use-detour-home-controller';

export default function HomeScreen() {
  const controller = useDetourHomeController();
  const shellScale = useRef(new Animated.Value(1)).current;
  const stageX = useJourneyStageMotion(controller.stage);
  const motionController = usePhysicalController(controller, shellScale);

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateX: stageX }, { scale: shellScale }],
      }}
    >
      <DetourHomeView controller={motionController} />
      <PrinterPhysicalHaptics controller={controller} />
      <ReadyTicketTearOverlay controller={motionController} />
    </Animated.View>
  );
}

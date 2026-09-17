import { View } from 'react-native';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodWanderIcon from '../../assets/mood/wander.svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';

export function V45Skyline() {
  const buildings = [
    { left: 0, width: 34, height: 38 },
    { left: 28, width: 25, height: 62 },
    { left: 58, width: 42, height: 29 },
    { left: 104, width: 22, height: 49 },
    { left: 132, width: 55, height: 35 },
    { left: 194, width: 31, height: 58 },
    { left: 232, width: 44, height: 42 },
    { left: 286, width: 24, height: 66 },
    { left: 318, width: 58, height: 31 },
  ];

  return (
    <View pointerEvents="none" style={styles.v45Skyline}>
      {buildings.map((building, index) => (
        <View
          key={`${building.left}-${index}`}
          style={[
            styles.v45SkylineBuilding,
            {
              left: building.left,
              width: building.width,
              height: building.height,
            },
          ]}
        />
      ))}

      <View style={styles.v45SkylineBridgeDeck} />
      <View style={styles.v45SkylineBridgeArch} />
    </View>
  );
}

export function V45MoodIcon({
  moodId,
  size = 76,
}: {
  moodId: MoodId;
  size?: number;
}) {
  // Ticket passes size=30.
  // Render it larger and position it in the ticket's lower-right cell.
  const ticketPlacement = size === 30;
  const renderSize = ticketPlacement ? 46 : size;

  const commonProps = {
    width: renderSize,
    height: renderSize,
  };

  let icon;

  if (moodId === 'wander') {
    icon = <MoodWanderIcon {...commonProps} />;
  } else if (moodId === 'food') {
    icon = <MoodFoodIcon {...commonProps} />;
  } else {
    icon = <MoodColorIcon {...commonProps} />;
  }

  if (ticketPlacement) {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 4,
          top: 52,
          width: renderSize,
          height: renderSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
    );
  }

  return icon;
}
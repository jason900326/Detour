import { View } from 'react-native';
import MoodWanderIcon from '../../assets/mood/wander.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodQuietIcon from '../../assets/mood/quiet.svg';
import MoodWeirdIcon from '../../assets/mood/weird.svg';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodSurpriseIcon from '../../assets/mood/surprise.svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';

type MoodGlyphProps = {
  moodId: MoodId;
  active: boolean;
};

export function MoodGlyph({ moodId, active }: MoodGlyphProps) {
  const rootStyle = [
    styles.v44MoodGlyph,
    active && styles.v44MoodGlyphActive,
  ];

  if (moodId === 'wander') {
    return (
      <View style={rootStyle}>
        <View style={styles.v44WanderStem} />
        <View style={styles.v44WanderBranchLeft} />
        <View style={styles.v44WanderBranchRight} />
        <View style={styles.v44WanderOrigin} />
        <View style={styles.v44WanderChoice} />
      </View>
    );
  }

  if (moodId === 'food') {
    return (
      <View style={rootStyle}>
        <View style={styles.v44FoodPlate} />
        <View style={styles.v44FoodForkHandle} />
        <View style={styles.v44FoodForkTineA} />
        <View style={styles.v44FoodForkTineB} />
        <View style={styles.v44FoodForkTineC} />
        <View style={styles.v44FoodKnife} />
      </View>
    );
  }

  if (moodId === 'quiet') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44QuietBar, styles.v44QuietBarA]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarB]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarC]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarD]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarE]} />
        <View style={styles.v44QuietSlash} />
      </View>
    );
  }

  if (moodId === 'weird') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileA]} />
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileB]} />
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileC]} />
        <View style={styles.v44WeirdOddTile} />
      </View>
    );
  }

  if (moodId === 'color') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchBack]} />
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchSignal]} />
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchFront]} />
      </View>
    );
  }

  if (moodId === 'slow') {
    return (
      <View style={rootStyle}>
        <View style={{ position: 'absolute', left: 18, top: 45, width: 30, height: 5, borderRadius: 3, backgroundColor: '#11110F', transform: [{ rotate: '-24deg' }] }} />
        <View style={{ position: 'absolute', left: 42, top: 30, width: 29, height: 5, borderRadius: 3, backgroundColor: '#11110F', transform: [{ rotate: '18deg' }] }} />
        <View style={{ position: 'absolute', left: 65, top: 34, width: 15, height: 15, borderRadius: 8, borderWidth: 4, borderColor: '#FF6A2A' }} />
      </View>
    );
  }

  return (
    <View style={rootStyle}>
      <View style={styles.v44FateDie}>
        <View style={[styles.v44FatePip, styles.v44FatePipA]} />
        <View style={[styles.v44FatePip, styles.v44FatePipB]} />
        <View style={[styles.v44FatePip, styles.v44FatePipC]} />
      </View>
      <View style={styles.v44FateSignal} />
    </View>
  );
}

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

export function V45MoodIcon({ moodId, size = 76 }: { moodId: MoodId; size?: number }) {
  const commonProps = { width: size, height: size };
  if (moodId === 'wander') return <MoodWanderIcon {...commonProps} />;
  if (moodId === 'food') return <MoodFoodIcon {...commonProps} />;
  if (moodId === 'quiet') return <MoodQuietIcon {...commonProps} />;
  if (moodId === 'weird') return <MoodWeirdIcon {...commonProps} />;
  if (moodId === 'color') return <MoodColorIcon {...commonProps} />;
  if (moodId === 'slow') {
    const scale = size / 76;
    return (
      <View style={{ width: size, height: size }}>
        <View style={{ position: 'absolute', left: 5 * scale, top: 48 * scale, width: 28 * scale, height: 6 * scale, borderRadius: 3 * scale, backgroundColor: '#11110F', transform: [{ rotate: '-31deg' }] }} />
        <View style={{ position: 'absolute', left: 28 * scale, top: 31 * scale, width: 27 * scale, height: 6 * scale, borderRadius: 3 * scale, backgroundColor: '#11110F', transform: [{ rotate: '19deg' }] }} />
        <View style={{ position: 'absolute', left: 50 * scale, top: 35 * scale, width: 18 * scale, height: 6 * scale, borderRadius: 3 * scale, backgroundColor: '#11110F', transform: [{ rotate: '-22deg' }] }} />
        <View style={{ position: 'absolute', left: 2 * scale, top: 50 * scale, width: 12 * scale, height: 12 * scale, borderRadius: 6 * scale, backgroundColor: '#FF6A2A' }} />
        <View style={{ position: 'absolute', right: 1 * scale, top: 26 * scale, width: 20 * scale, height: 20 * scale, borderRadius: 10 * scale, borderWidth: 5 * scale, borderColor: '#FF6A2A', backgroundColor: '#F5F1E8' }} />
      </View>
    );
  }
  return <MoodSurpriseIcon {...commonProps} />;
}

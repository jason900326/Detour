import { useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';
import { SIGNAL } from '../theme/detour-theme';
import { V45MoodIcon } from './mood-visuals';

let ticketArtworkDecoded = false;

const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];
const DETOUR_TICKET_EDGE = Array.from({ length: 8 }, (_, index) => 30 + index * 50);

export type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
};

export function DetourTicket({
  timeLabel,
  moodLabel,
  serial,
  stamped = false,
  stampProgress,
}: DetourTicketProps) {
  const stampStyle = stampProgress
    ? {
        opacity: stampProgress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0.18, 1],
        }),
        transform: [
          { rotate: '-7deg' },
          {
            translateY: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [-28, 3, 0],
            }),
          },
          {
            scale: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [1.32, 0.94, 1],
            }),
          },
        ],
      }
    : {
        opacity: stamped ? 1 : 0,
        transform: [{ rotate: '-7deg' }],
      };

  return (
    <View style={styles.v44TicketPaper}>
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`left-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeLeft, { top }]} />
      ))}
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`right-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeRight, { top }]} />
      ))}

      <View style={styles.v44TicketHeader}>
        <Text style={styles.v44TicketBrand}>DETOUR</Text>
        <Text style={styles.v44TicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v44TicketRule} />

      <View style={styles.v44TicketTimeBlock}>
        <Text style={styles.v44TicketLabel}>時間</Text>
        <View style={styles.v44TicketTimeRow}>
          <Text style={styles.v44TicketTime}>{timeLabel}</Text>
          <Text style={styles.v44TicketTimeUnit}>分鐘</Text>
        </View>
      </View>

      <View style={styles.v44TicketMoodBlock}>
        <View style={styles.v44TicketMoodCopy}>
          <Text style={styles.v44TicketLabel}>心情</Text>
          <Text style={styles.v44TicketMood}>{moodLabel}</Text>
        </View>

        {stamped && (
          <Animated.View style={[styles.v44TicketStamp, stampStyle]}>
            <Text style={styles.v44TicketStampText}>終點保密</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.v44TicketDash} />

      <View style={styles.v44TicketFooter}>
        <View style={styles.v44TicketBarcode}>
          {DETOUR_TICKET_BARS.map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.v44TicketBar, { width }]} />
          ))}
        </View>
      </View>
    </View>
  );
}




export function DetourAccentStroke({
  width,
  style,
}: {
  width: number;
  style?: any;
}) {
  const height = 18;
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <SvgPath
          d={`M 5 12 Q ${Math.round(width * 0.52)} 4 ${width - 5} 8`}
          fill="none"
          stroke={SIGNAL}
          strokeWidth={7}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// DETOUR V45 — ticket / mood / recap visual system

export function V45Ticket({ timeLabel, moodLabel, moodId, serial, stamped = false, stampProgress }: { timeLabel: string; moodLabel: string; moodId: MoodId; serial: string; stamped?: boolean; stampProgress?: Animated.Value; }) {
  const [artworkReady, setArtworkReady] = useState(ticketArtworkDecoded);
  const markArtworkReady = () => {
    ticketArtworkDecoded = true;
    setArtworkReady(true);
  };

  const stampScale = stampProgress
    ? stampProgress.interpolate({ inputRange: [0, 1], outputRange: [1.28, 1] })
    : 1;
  const stampOpacity = stampProgress ?? (stamped ? 1 : 0);

  return (
    <View style={[styles.v46ArtTicket, !artworkReady && styles.v49TicketArtworkPending]}>
      <Image
        source={require('../../assets/detour/ticket-base.png')}
        style={styles.v46ArtTicketBase}
        resizeMode="stretch"
        onLoad={markArtworkReady}
        onLoadEnd={markArtworkReady}
      />

      <View style={styles.v46ArtTicketHeader}>
        <Text style={styles.v46ArtTicketBrand}>DETOUR</Text>
        <Text style={styles.v46ArtTicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v46ArtTicketTimeBlock}>
        <Text style={styles.v46ArtTicketLabel}>旅程時間</Text>
        <View style={styles.v46ArtTicketTimeRow}>
          <Text style={styles.v46ArtTicketMinutes}>{timeLabel}</Text>
          <Text style={styles.v46ArtTicketMinutesUnit}>分鐘</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketMoodBlock}>
        <Text style={styles.v46ArtTicketLabel}>此趟心情</Text>
        <View style={styles.v46ArtTicketMoodRow}>
          <V45MoodIcon moodId={moodId} size={43} />
          <Text style={styles.v46ArtTicketMoodText}>{moodLabel}</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketDestinationBlock}>
        <Text style={styles.v46ArtTicketLabel}>目的地</Text>
        <View style={styles.v46ArtTicketUnknownRow}>
          <View style={styles.v46ArtTicketPin}>
            <View style={styles.v46ArtTicketPinCore} />
          </View>
          <Text style={styles.v46ArtTicketUnknown}>???</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketMiniRoute}>
        <View style={styles.v46ArtMiniStart} />
        <View style={[styles.v46ArtMiniDash, { left: 15, top: 28, transform: [{ rotate: '12deg' }] }]} />
        <View style={styles.v46ArtMiniTree} />
        <View style={[styles.v46ArtMiniDash, { left: 70, top: 22, transform: [{ rotate: '-17deg' }] }]} />
        <View style={styles.v46ArtMiniFlagPole} />
        <View style={styles.v46ArtMiniFlag} />
      </View>

      <View style={styles.v46ArtBarcode}>
        {Array.from({ length: 29 }).map((_, index) => (
          <View
            key={`art-barcode-${index}`}
            style={[
              styles.v46ArtBarcodeBar,
              { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },
            ]}
          />
        ))}
      </View>

      {stamped && (
        <Animated.View
          style={[
            styles.v46ArtSecretStamp,
            {
              opacity: stampOpacity,
              transform: [{ rotate: '-8deg' }, { scale: stampScale }],
            },
          ]}
        >
          <Text style={styles.v46ArtSecretStampText}>終點保密</Text>
        </Animated.View>
      )}
    </View>
  );
}

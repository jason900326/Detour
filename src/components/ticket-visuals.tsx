import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';
import { SIGNAL } from '../theme/detour-theme';
import { V45MoodIcon } from './mood-visuals';
import { useTicketTear } from './ticket-tear-context';

let ticketArtworkDecoded = false;

const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];
const DETOUR_TICKET_EDGE = Array.from({ length: 8 }, (_, index) => 30 + index * 50);

export const DETOUR_TICKET_WIDTH = 310;
export const DETOUR_TICKET_MAIN_SOURCE = require('../../assets/detour/ticket-main.png');
export const DETOUR_TICKET_STUB_SOURCE = require('../../assets/detour/ticket-stub.png');

const TICKET_ARTWORK = Image.resolveAssetSource(DETOUR_TICKET_MAIN_SOURCE);
const STUB_ARTWORK = Image.resolveAssetSource(DETOUR_TICKET_STUB_SOURCE);

export const DETOUR_TICKET_HEIGHT =
  DETOUR_TICKET_WIDTH * (TICKET_ARTWORK.height / TICKET_ARTWORK.width);

// Geometry measured from the artwork reference supplied with the corrected
// stub. The main paper lives inside a larger transparent export canvas; the
// detachable strip belongs in that lower transparent area rather than on top
// of the printed content.
const TICKET_REFERENCE_WIDTH = 1122;
const TICKET_REFERENCE_HEIGHT = 1402;
const MAIN_PAPER_LEFT = 35;
const MAIN_PAPER_WIDTH = 1052;
const MAIN_PAPER_BOTTOM = 1127;
const TEAR_TOOTH_OVERLAP = 20;

export const DETOUR_TICKET_STUB_LEFT =
  DETOUR_TICKET_WIDTH * (MAIN_PAPER_LEFT / TICKET_REFERENCE_WIDTH);
export const DETOUR_TICKET_STUB_WIDTH =
  DETOUR_TICKET_WIDTH * (MAIN_PAPER_WIDTH / TICKET_REFERENCE_WIDTH);
export const DETOUR_TICKET_STUB_HEIGHT =
  DETOUR_TICKET_STUB_WIDTH * (STUB_ARTWORK.height / STUB_ARTWORK.width);
export const DETOUR_TICKET_STUB_TOP =
  DETOUR_TICKET_HEIGHT *
  ((MAIN_PAPER_BOTTOM - TEAR_TOOTH_OVERLAP) / TICKET_REFERENCE_HEIGHT);

// The gesture follows the actual bottom tear edge of the main ticket. The
// stub itself overlaps behind that edge by one tooth depth so the two paper
// pieces visually join without a background slit.
export const DETOUR_TICKET_TEAR_SEAM_RATIO =
  MAIN_PAPER_BOTTOM / TICKET_REFERENCE_HEIGHT;

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

function TearableTicketStub() {
  const { dragX, dragY, opacity } = useTicketTear();
  const rotate = dragX.interpolate({
    inputRange: [-DETOUR_TICKET_WIDTH, 0, DETOUR_TICKET_WIDTH],
    outputRange: ['-9deg', '0deg', '9deg'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: DETOUR_TICKET_STUB_TOP,
        left: DETOUR_TICKET_STUB_LEFT,
        width: DETOUR_TICKET_STUB_WIDTH,
        height: DETOUR_TICKET_STUB_HEIGHT,
        opacity,
        transform: [{ translateX: dragX }, { translateY: dragY }, { rotate }],
      }}
    >
      <Image
        source={DETOUR_TICKET_STUB_SOURCE}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// DETOUR V45 — ticket / mood / recap visual system

type V45TicketProps = {
  timeLabel: string;
  moodLabel: string;
  moodId: MoodId;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
  artworkVisible?: boolean;
  showBarcode?: boolean;
  showStubArtwork?: boolean;
};

export function V45Ticket({
  timeLabel,
  moodLabel,
  moodId,
  serial,
  stamped = false,
  stampProgress,
  artworkVisible = true,
  showBarcode = true,
  showStubArtwork = true,
}: V45TicketProps) {
  const [artworkReady, setArtworkReady] = useState(
    artworkVisible ? ticketArtworkDecoded : true
  );
  const feedJitter = useRef(new Animated.Value(0)).current;
  const ticketRef = useRef<View>(null);
  const { enabled: tearEnabled, setTicketBounds } = useTicketTear();

  const markArtworkReady = () => {
    ticketArtworkDecoded = true;
    setArtworkReady(true);
  };

  const measureTicket = useCallback(() => {
    if (!tearEnabled) return;

    requestAnimationFrame(() => {
      ticketRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        setTicketBounds({
          x,
          y,
          width,
          height,
          seamY: y + height * DETOUR_TICKET_TEAR_SEAM_RATIO,
        });
      });
    });
  }, [setTicketBounds, tearEnabled]);

  useEffect(() => {
    if (!artworkVisible) {
      setArtworkReady(true);
    }
  }, [artworkVisible]);

  useEffect(() => {
    measureTicket();
  }, [measureTicket]);

  useEffect(() => {
    feedJitter.stopAnimation();
    feedJitter.setValue(0);

    if (stamped) return;

    const feedLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(feedJitter, {
          toValue: 1,
          duration: 54,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 2,
          duration: 48,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 3,
          duration: 62,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 0,
          duration: 88,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(330),
      ])
    );

    feedLoop.start();

    return () => {
      feedLoop.stop();
      feedJitter.setValue(0);
    };
  }, [feedJitter, stamped]);

  const stampScale = stampProgress
    ? stampProgress.interpolate({ inputRange: [0, 1], outputRange: [1.28, 1] })
    : 1;
  const stampOpacity = stampProgress ?? (stamped ? 1 : 0);

  const feedStyle = {
    transform: [
      {
        translateX: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [0, -0.9, 0.65, -0.3],
        }),
      },
      {
        translateY: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [0, 0.55, 0.08, 0.34],
        }),
      },
      {
        rotate: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: ['0deg', '-0.08deg', '0.06deg', '-0.03deg'],
        }),
      },
    ],
  };

  return (
    <Animated.View
      ref={ticketRef}
      onLayout={measureTicket}
      style={[
        styles.v46ArtTicket,
        { height: DETOUR_TICKET_HEIGHT },
        artworkVisible && !artworkReady && styles.v49TicketArtworkPending,
        feedStyle,
      ]}
    >
      {artworkVisible && (
        <>
          {showStubArtwork && <TearableTicketStub />}
          <Image
            source={DETOUR_TICKET_MAIN_SOURCE}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DETOUR_TICKET_WIDTH,
              height: DETOUR_TICKET_HEIGHT,
            }}
            resizeMode="contain"
            onLoad={markArtworkReady}
            onLoadEnd={markArtworkReady}
          />
        </>
      )}

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

      {showBarcode && (
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
      )}

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
    </Animated.View>
  );
}

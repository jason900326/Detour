import { useState, type Ref } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { PocketJourney } from "../../lib/pocket-engine";
import { sharePhotos, shareRoute } from "../../lib/pocket-share";
import { DetourBrand } from "./pocket-home-art";
import { C } from "./pocket-ui";

/** One bounded canvas is both the preview and the capture target (1080 × 1920 export). */
export function PocketShareCard({ journey, cover, cardRef, onPhotoLoad, onPhotoError }: {
  journey: PocketJourney;
  cover?: string;
  cardRef: Ref<View>;
  onPhotoLoad: (uri: string) => void;
  onPhotoError: (uri: string) => void;
}) {
  const [width, setWidth] = useState(360);
  const scale = width / 360;
  const photos = sharePhotos(journey.photos, cover);
  const route = shareRoute(journey.trace, photos.length ? 82 : 280, photos.length ? 204 : 310);
  const box = (left: number, top: number, w: number, h: number) => ({
    position: "absolute" as const, left: left * scale, top: top * scale,
    width: w * scale, height: h * scale, overflow: "hidden" as const,
  });
  const photo = (uri: string, index: number) => (
    <Image key={uri} source={{ uri }} resizeMode="cover"
      accessibilityLabel={index ? `沿途照片 ${index + 1}` : "這趟的封面"}
      onLoad={() => onPhotoLoad(uri)} onError={() => onPhotoError(uri)}
      style={[StyleSheet.absoluteFill, { backgroundColor: C.white }]} />
  );
  return (
    <View ref={cardRef} collapsable={false} testID="pocket-share-card"
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={{ width: "100%", aspectRatio: 9 / 16, backgroundColor: C.paper, overflow: "hidden" }}>
      <View style={box(24, 22, 312, 42)}>
        <View style={{ transformOrigin: "top left", transform: [{ scale }], width: 312 }}><DetourBrand allowFontScaling={false} /></View>
      </View>
      <View style={[box(24, 72, 312, 1), { backgroundColor: C.ink }]} />
      {photos.length > 0 && <>
        <View testID="share-hero" style={box(24, 94, 208, 260)}>{photo(photos[0], 0)}</View>
        <View style={box(24, 368, 312, 90)}>
          {photos.slice(1).map((uri, i) => (
            <View key={uri} testID={`share-thumb-${i}`} style={box(i * 80, 0, 72, 90)}>{photo(uri, i + 1)}</View>
          ))}
        </View>
      </>}
      <View testID="share-route" style={photos.length ? box(248, 108, 88, 246) : box(40, 105, 280, 335)}>
        <Text allowFontScaling={false} style={{ color: C.muted, fontSize: 9 * scale, letterSpacing: 1 * scale, marginBottom: 12 * scale }}>繞過的形狀</Text>
        {route ? <Svg width="100%" height={photos.length ? 204 * scale : 310 * scale} viewBox={`0 0 ${photos.length ? 82 : 280} ${photos.length ? 204 : 310}`}>
          <Path d={route.path} fill="none" stroke={C.orange} strokeWidth={photos.length ? 2.6 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={route.start.x} cy={route.start.y} r={4} fill={C.paper} stroke={C.ink} strokeWidth={2} />
          <Circle cx={route.end.x} cy={route.end.y} r={4} fill={C.orange} />
        </Svg> : <Text allowFontScaling={false} style={{ marginTop: 36 * scale, fontSize: 12 * scale, lineHeight: 22 * scale, color: C.muted }}>留在路上，{"\n"}也留在心裡。</Text>}
      </View>
      <View testID="share-discoveries" style={box(24, 480, 312, 40)}>
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 27 * scale, lineHeight: 38 * scale, letterSpacing: 3 * scale }}>
          {journey.found.map(f => f.emoji).join(" ") || "一點時間，一點意外。"}
        </Text>
      </View>
      <View style={[box(24, 531, 30, 3), { backgroundColor: C.orange }]} />
      <View testID="share-phrase" style={box(24, 547, 312, 70)}>
        <Text allowFontScaling={false} style={{ color: C.ink, fontSize: 25 * scale, lineHeight: 33 * scale, fontWeight: "800", letterSpacing: -0.5 * scale }}>
          沒有特別去哪，{"\n"}卻帶回了一點什麼。
        </Text>
      </View>
    </View>
  );
}

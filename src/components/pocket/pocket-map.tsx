import { useRef } from "react";
import MapView, { Polyline, Marker } from "react-native-maps";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { Point } from "../../lib/pocket-engine";

export default function PocketMap({
  trace,
  route,
  style,
}: {
  trace: Point[];
  route: Point[];
  style?: StyleProp<ViewStyle>;
}) {
  const point = trace.at(-1);
  const map = useRef<MapView>(null);
  if (!point) return null;

  return (
    <View
      style={[
        {
          minHeight: 340,
          borderRadius: 24,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{
          ...point,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }}
        showsUserLocation
        followsUserLocation
        showsCompass={false}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onUserLocationChange={(event) => {
          const next = event.nativeEvent.coordinate;
          if (!next) return;
          map.current?.animateCamera(
            {
              center: {
                latitude: next.latitude,
                longitude: next.longitude,
              },
            },
            { duration: 280 },
          );
        }}
      >
        <Polyline coordinates={trace} strokeColor="#F4623C" strokeWidth={4} />
        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor="#807392"
            strokeWidth={3}
            lineDashPattern={[6, 5]}
          />
        )}
        <Marker coordinate={trace[0]} title="這趟的起點" />
      </MapView>
    </View>
  );
}

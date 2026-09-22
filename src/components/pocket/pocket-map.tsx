import MapView, { Polyline, Marker } from "react-native-maps";
import { View } from "react-native";
import type { Point } from "../../lib/pocket-engine";
export default function PocketMap({
  trace,
  route,
}: {
  trace: Point[];
  route: Point[];
}) {
  const point = trace.at(-1);
  if (!point) return null;
  return (
    <View
      style={{
        height: 220,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          ...point,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }}
        showsUserLocation
        showsCompass
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

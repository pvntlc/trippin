// 네이티브(iOS/Android) 지도 — react-native-maps.
// 웹에서는 PlacesMap.web.tsx 가 대신 사용됨 (Metro 가 플랫폼별로 해석).
import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { Colors } from "../constants/colors";
import { mapCenter, type MapPlace, type MapRoute } from "./mapTypes";

export function PlacesMap({ places, routes = [] }: { places: MapPlace[]; routes?: MapRoute[] }) {
  const c = mapCenter(places);
  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: c.lat, longitude: c.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        {routes.map((r) => (
          <Polyline
            key={r.key}
            coordinates={r.coords.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={r.color}
            strokeWidth={4}
          />
        ))}
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.name}
            description={p.day_index === null ? "가고 싶은 곳" : `Day ${p.day_index + 1}`}
            pinColor={Colors.accent}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
});

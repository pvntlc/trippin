// 네이티브(iOS/Android) 지도 — react-native-maps.
// 웹에서는 PlacesMap.web.tsx 가 대신 사용됨 (Metro 가 플랫폼별로 해석).
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { Colors } from "../constants/colors";
import { mapCenter, type MapPlace, type MapRoute, type MapStation } from "./mapTypes";

export function PlacesMap({
  places,
  routes = [],
  stations = [],
}: {
  places: MapPlace[];
  routes?: MapRoute[];
  stations?: MapStation[];
}) {
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
        {stations.map((s) => (
          <Marker
            key={s.key}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.name}
            description={s.board ? "승차" : "환승/하차"}
            anchor={{ x: 0.5, y: 1 }}
          >
            {/* 역명을 흰 배경 알약으로 항상 표시 (탭 없이도 또렷하게) */}
            <View style={styles.stationWrap}>
              <View style={styles.stationPill}>
                <Text style={styles.stationText}>{s.name}</Text>
              </View>
              <View style={styles.stationDot} />
            </View>
          </Marker>
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
  stationWrap: { alignItems: "center" },
  stationPill: {
    backgroundColor: "#ffffff",
    borderColor: Colors.accent,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stationText: { color: "#0c4a6e", fontSize: 12, fontWeight: "700" },
  stationDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderColor: "#ffffff",
    borderWidth: 1.5,
    marginTop: 2,
  },
});

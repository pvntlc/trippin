// 네이티브(iOS/Android) 지도 — react-native-maps.
// 웹에서는 PlacesMap.web.tsx 가 대신 사용됨 (Metro 가 플랫폼별로 해석).
import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";

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
  const mapRef = useRef<MapView | null>(null);

  const goToMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600
      );
    } catch {
      // 위치 못 가져오면 무시
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation
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

      <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation} activeOpacity={0.8}>
        <Text style={styles.myLocIcon}>📍</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  myLocBtn: {
    position: "absolute", right: 14, bottom: 64,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  myLocIcon: { fontSize: 20 },
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

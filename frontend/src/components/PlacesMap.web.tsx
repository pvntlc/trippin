// 웹 지도 — @vis.gl/react-google-maps (Google Maps JavaScript API).
// 네이티브에서는 PlacesMap.tsx(react-native-maps)가 사용됨.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

import { Colors } from "../constants/colors";
import { mapCenter, type MapPlace } from "./mapTypes";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export function PlacesMap({ places }: { places: MapPlace[] }) {
  const c = mapCenter(places);

  if (!KEY) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          지도를 보려면 frontend/.env 에{"\n"}EXPO_PUBLIC_GOOGLE_MAPS_KEY 를 설정하세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <APIProvider apiKey={KEY}>
        <Map
          style={{ width: "100%", height: "100%" }}
          defaultCenter={c}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {places.map((p) => (
            <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }} title={p.name} />
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholderText: { color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
});

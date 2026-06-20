// 웹 지도 — @vis.gl/react-google-maps (Google Maps JavaScript API).
// 네이티브에서는 PlacesMap.tsx(react-native-maps)가 사용됨.
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { APIProvider, Map, Marker, InfoWindow } from "@vis.gl/react-google-maps";

import { Colors } from "../constants/colors";
import { mapCenter, type MapPlace } from "./mapTypes";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

function dayLabel(d: number | null) {
  return d === null ? "가고 싶은 곳" : `Day ${d + 1}`;
}

export function PlacesMap({ places }: { places: MapPlace[] }) {
  const c = mapCenter(places);
  const [selected, setSelected] = useState<MapPlace | null>(null);

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
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.name}
              onClick={() => setSelected(p)}
            />
          ))}
          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
              pixelOffset={[0, -36]}
            >
              <div style={{ padding: "2px 4px", fontFamily: "system-ui, sans-serif" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "#0284c7", marginTop: 2 }}>{dayLabel(selected.day_index)}</div>
              </div>
            </InfoWindow>
          )}
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

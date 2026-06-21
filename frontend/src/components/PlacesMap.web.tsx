// 웹 지도 — @vis.gl/react-google-maps (Google Maps JavaScript API).
// 네이티브에서는 PlacesMap.tsx(react-native-maps)가 사용됨.
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { APIProvider, Map, Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps";

import { Colors } from "../constants/colors";
import { mapCenter, type MapPlace, type MapRoute, type MapStation } from "./mapTypes";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

function dayLabel(d: number | null) {
  return d === null ? "가고 싶은 곳" : `Day ${d + 1}`;
}

// @vis.gl 1.x 에는 Polyline 컴포넌트가 없어 google.maps API 로 직접 그린다.
function Routes({ routes }: { routes: MapRoute[] }) {
  const map = useMap();
  useEffect(() => {
    const g = (window as any).google;
    if (!map || !g?.maps) return;
    const lines = routes.map(
      (r) =>
        new g.maps.Polyline({
          path: r.coords,
          map,
          strokeColor: r.color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          icons: [{ icon: { path: g.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5 }, offset: "50%", repeat: "120px" }],
        })
    );
    return () => lines.forEach((l: any) => l.setMap(null));
  }, [map, routes]);
  return null;
}

// 역 마커 — 잘 보이게 큰 핀(SVG) + 큰 역명 라벨
const STATION_PIN =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">' +
      '<path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 15 26 15 26s15-15.5 15-26C32 7.7 25.3 1 17 1z" fill="#0ea5e9" stroke="#ffffff" stroke-width="2.5"/>' +
      '<circle cx="17" cy="16" r="6.5" fill="#ffffff"/>' +
      "</svg>"
  );

function Stations({ stations }: { stations: MapStation[] }) {
  const map = useMap();
  useEffect(() => {
    const g = (window as any).google;
    if (!map || !g?.maps) return;
    const markers = stations.map(
      (s) =>
        new g.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          title: s.name,
          label: { text: `🚉 ${s.name}`, fontSize: "13px", fontWeight: "800", color: "#0c4a6e" },
          icon: {
            url: STATION_PIN,
            scaledSize: new g.maps.Size(34, 44),
            anchor: new g.maps.Point(17, 44),
            labelOrigin: new g.maps.Point(17, 55),
          },
          zIndex: 999,
        })
    );
    return () => markers.forEach((m: any) => m.setMap(null));
  }, [map, stations]);
  return null;
}

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
          <Routes routes={routes} />
          <Stations stations={stations} />
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

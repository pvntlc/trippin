import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { placeApi, type Place } from "../../services/api";
import { PlacesMap } from "../../components/PlacesMap";
import { type MapPlace, type MapRoute, dayColor } from "../../components/mapTypes";
import { Colors } from "../../constants/colors";

// 일정 탭과 동일하게 시간순 정렬 (시간 있는 것 먼저, 없으면 순서대로)
function sortByTime(arr: Place[]): Place[] {
  return [...arr].sort((a, b) => {
    if (a.planned_time && b.planned_time) return a.planned_time.localeCompare(b.planned_time);
    if (a.planned_time) return -1;
    if (b.planned_time) return 1;
    return a.order_index - b.order_index;
  });
}

export function MapTab({ tripId }: { tripId: number }) {
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });

  const mapPlaces: MapPlace[] = useMemo(
    () =>
      (places ?? [])
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ id: p.id, name: p.name, lat: p.lat as number, lng: p.lng as number, day_index: p.day_index })),
    [places]
  );

  // Day 별 경로: 좌표가 있는 장소를 시간순으로 이어 선으로 표시 (가고 싶은 곳 제외)
  const routes: MapRoute[] = useMemo(() => {
    const byDay: Record<string, Place[]> = {};
    (places ?? [])
      .filter((p) => p.lat != null && p.lng != null && p.day_index !== null)
      .forEach((p) => {
        const k = String(p.day_index);
        (byDay[k] ??= []).push(p);
      });
    return Object.entries(byDay)
      .map(([k, arr]) => ({
        key: k,
        color: dayColor(Number(k)),
        coords: sortByTime(arr).map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
      }))
      .filter((r) => r.coords.length >= 2);
  }, [places]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  if (mapPlaces.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>지도에 표시할 장소가 없어요.{"\n"}일정 탭에서 장소를 추가해 보세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PlacesMap places={mapPlaces} routes={routes} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>📍 {mapPlaces.length}곳{routes.length ? ` · ${routes.length}일 경로` : ""}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
  badge: { position: "absolute", top: 12, left: 12, backgroundColor: Colors.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: 13, fontWeight: "700", color: Colors.text },
});

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useQueries } from "@tanstack/react-query";

import { placeApi, mapsApi, type Place, type TransitOption, type LatLngTuple } from "../../services/api";
import { PlacesMap } from "../../components/PlacesMap";
import { type MapPlace, type MapRoute, dayColor } from "../../components/mapTypes";
import { type LegMode } from "./TravelLeg";
import { Colors } from "../../constants/colors";

// 일정 탭과 동일하게 시간순 정렬
function sortByTime(arr: Place[]): Place[] {
  return [...arr].sort((a, b) => {
    if (a.planned_time && b.planned_time) return a.planned_time.localeCompare(b.planned_time);
    if (a.planned_time) return -1;
    if (b.planned_time) return 1;
    return a.order_index - b.order_index;
  });
}

type Leg = { key: string; from: Place; to: Place; day: number };

export function MapTab({
  tripId,
  legModes,
  transitChoices,
}: {
  tripId: number;
  legModes: Record<string, LegMode>;
  transitChoices: Record<string, TransitOption>;
}) {
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

  // 연속 장소쌍(구간) — 일정 탭과 같은 키(`${prevId}-${id}`) 로 매칭
  const legs: Leg[] = useMemo(() => {
    const byDay: Record<string, Place[]> = {};
    (places ?? [])
      .filter((p) => p.lat != null && p.lng != null && p.day_index !== null)
      .forEach((p) => {
        (byDay[String(p.day_index)] ??= []).push(p);
      });
    const out: Leg[] = [];
    Object.entries(byDay).forEach(([k, arr]) => {
      const sorted = sortByTime(arr);
      for (let i = 1; i < sorted.length; i++) {
        out.push({ key: `${sorted[i - 1].id}-${sorted[i].id}`, from: sorted[i - 1], to: sorted[i], day: Number(k) });
      }
    });
    return out;
  }, [places]);

  // 구간별 실제 경로 지오메트리 조회 (대중교통이고 선택해둔 게 있으면 그 경로, 아니면 모드대로 조회)
  const queries = useQueries({
    queries: legs.map((leg) => {
      const mode = legModes[leg.key] ?? "walking";
      const haveShape = mode === "transit" && (transitChoices[leg.key]?.shape?.length ?? 0) >= 2;
      return {
        queryKey: ["legGeom", leg.from.id, leg.to.id, mode] as const,
        queryFn: () => mapsApi.directions(`${leg.from.lat},${leg.from.lng}`, `${leg.to.lat},${leg.to.lng}`, mode),
        enabled: !haveShape,
        staleTime: 30 * 60_000,
      };
    }),
  });

  const geomSig = queries.map((q) => q.data?.polyline?.length ?? 0).join(",");

  const routes: MapRoute[] = useMemo(() => {
    return legs.map((leg, i) => {
      const mode = legModes[leg.key] ?? "walking";
      const chosen = transitChoices[leg.key];
      let shape: LatLngTuple[] | undefined;
      if (mode === "transit" && (chosen?.shape?.length ?? 0) >= 2) shape = chosen!.shape;
      else shape = queries[i]?.data?.polyline;
      const coords =
        shape && shape.length >= 2
          ? shape.map(([lat, lng]) => ({ lat, lng }))
          : [
              { lat: leg.from.lat as number, lng: leg.from.lng as number },
              { lat: leg.to.lat as number, lng: leg.to.lng as number },
            ];
      return { key: leg.key, color: dayColor(leg.day), coords };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, legModes, transitChoices, geomSig]);

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
        <Text style={styles.badgeText}>📍 {mapPlaces.length}곳{routes.length ? ` · ${routes.length}구간 경로` : ""}</Text>
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

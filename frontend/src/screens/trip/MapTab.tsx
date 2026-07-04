import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { useQuery, useQueries } from "@tanstack/react-query";

import { placeApi, mapsApi, type Place, type TransitOption, type LatLngTuple } from "../../services/api";
import { PlacesMap } from "../../components/PlacesMap";
import { type MapPlace, type MapRoute, type MapStation, dayColor } from "../../components/mapTypes";
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

  // 하단 칩 탭 → 그 위치로 지도 이동 (seq 로 같은 곳 다시 눌러도 재이동)
  const seq = useRef(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; seq: number } | null>(null);
  const focusOn = (p: MapPlace) => { seq.current += 1; setFocus({ lat: p.lat, lng: p.lng, seq: seq.current }); };

  // 일별 필터 — "all" | day_index | "wish"(가고 싶은 곳)
  const [dayFilter, setDayFilter] = useState<number | "all" | "wish">("all");
  const daysPresent = useMemo(() => {
    const s = new Set<number>();
    let hasWish = false;
    (places ?? []).forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      if (p.day_index == null) hasWish = true; else s.add(p.day_index);
    });
    return { days: [...s].sort((a, b) => a - b), hasWish };
  }, [places]);
  const fplaces = useMemo(() => {
    const all = places ?? [];
    if (dayFilter === "all") return all;
    if (dayFilter === "wish") return all.filter((p) => p.day_index == null);
    return all.filter((p) => p.day_index === dayFilter);
  }, [places, dayFilter]);

  const mapPlaces: MapPlace[] = useMemo(
    () =>
      fplaces
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ id: p.id, name: p.name, lat: p.lat as number, lng: p.lng as number, day_index: p.day_index })),
    [fplaces]
  );

  // 연속 장소쌍(구간) — 일정 탭과 같은 키(`${prevId}-${id}`) 로 매칭
  const legs: Leg[] = useMemo(() => {
    const byDay: Record<string, Place[]> = {};
    fplaces
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
  }, [fplaces]);

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

  // 대중교통 구간의 타고/내리는 역 마커
  const stations: MapStation[] = useMemo(() => {
    const out: MapStation[] = [];
    const seen = new Set<string>();
    legs.forEach((leg, i) => {
      if ((legModes[leg.key] ?? "walking") !== "transit") return;
      const list = transitChoices[leg.key]?.stations ?? queries[i]?.data?.stations ?? [];
      list.forEach((s) => {
        const k = `${s.name}@${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ key: k, name: s.name, lat: s.lat, lng: s.lng, board: s.board });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, legModes, transitChoices, geomSig]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  const totalCoord = (places ?? []).filter((p) => p.lat != null && p.lng != null).length;
  if (totalCoord === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>지도에 표시할 장소가 없어요.{"\n"}일정 탭에서 장소를 추가해 보세요.</Text>
      </View>
    );
  }

  const showDayChips = daysPresent.days.length + (daysPresent.hasWish ? 1 : 0) >= 2;

  return (
    <View style={styles.container}>
      <PlacesMap places={mapPlaces} routes={routes} stations={stations} focus={focus} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          📍 {mapPlaces.length}곳{routes.length ? ` · ${routes.length}구간 경로` : ""}{stations.length ? ` · 🚉 ${stations.length}역` : ""}
        </Text>
      </View>

      {/* 일별 필터 */}
      {showDayChips && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayFilter} contentContainerStyle={styles.dayFilterRow}>
          <TouchableOpacity style={[styles.dayChip, dayFilter === "all" && styles.dayChipOn]} onPress={() => setDayFilter("all")}>
            <Text style={[styles.dayChipText, dayFilter === "all" && styles.dayChipTextOn]}>전체</Text>
          </TouchableOpacity>
          {daysPresent.days.map((d) => (
            <TouchableOpacity key={d} style={[styles.dayChip, dayFilter === d && styles.dayChipOn]} onPress={() => setDayFilter(d)}>
              <View style={[styles.dayChipDot, { backgroundColor: dayColor(d) }]} />
              <Text style={[styles.dayChipText, dayFilter === d && styles.dayChipTextOn]}>Day {d + 1}</Text>
            </TouchableOpacity>
          ))}
          {daysPresent.hasWish && (
            <TouchableOpacity style={[styles.dayChip, dayFilter === "wish" && styles.dayChipOn]} onPress={() => setDayFilter("wish")}>
              <Text style={[styles.dayChipText, dayFilter === "wish" && styles.dayChipTextOn]}>가고 싶은 곳</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* 지도에 찍힌 핀이 어떤 장소인지 텍스트로 (하단 스트립) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pinList}
        contentContainerStyle={styles.pinListContent}
      >
        {mapPlaces.map((p) => (
          <TouchableOpacity key={p.id} style={styles.pinChip} activeOpacity={0.7} onPress={() => focusOn(p)}>
            <View style={[styles.pinDot, { backgroundColor: dayColor(p.day_index ?? 0) }]} />
            <Text style={styles.pinChipText} numberOfLines={1}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
  badge: { position: "absolute", top: 12, left: 12, backgroundColor: Colors.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: 13, fontWeight: "700", color: Colors.text },
  dayFilter: { position: "absolute", top: 48, left: 0, right: 0, maxHeight: 40 },
  dayFilterRow: { paddingHorizontal: 12, gap: 6, alignItems: "center" },
  dayChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  dayChipOn: { backgroundColor: Colors.accentDeep, borderColor: Colors.accentDeep },
  dayChipDot: { width: 8, height: 8, borderRadius: 4 },
  dayChipText: { fontSize: 12.5, fontWeight: "700", color: Colors.textSub },
  dayChipTextOn: { color: Colors.white },
  pinList: { position: "absolute", bottom: 12, left: 0, right: 0, maxHeight: 44 },
  pinListContent: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  pinChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bgCard, borderRadius: 16, paddingLeft: 8, paddingRight: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, maxWidth: 180 },
  pinDot: { width: 9, height: 9, borderRadius: 5 },
  pinChipText: { fontSize: 12.5, fontWeight: "700", color: Colors.text },
});

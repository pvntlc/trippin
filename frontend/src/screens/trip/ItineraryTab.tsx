import React, { useMemo, useState } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { placeApi, type Place, type Trip } from "../../services/api";
import { Colors } from "../../constants/colors";
import { PlaceSearchModal } from "./PlaceSearchModal";
import { PlaceEditModal } from "./PlaceEditModal";
import { TravelLeg } from "./TravelLeg";

// 두 좌표 직선거리(km) — 코스 정렬용
function haversine(a: Place, b: Place): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLng = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const la1 = toRad(a.lat ?? 0), la2 = toRad(b.lat ?? 0);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// 최단거리 근사(nearest-neighbor): 첫 장소에서 시작해 가까운 곳 순으로 잇기
function optimizeRoute(places: Place[]): Place[] {
  const coord = places.filter((p) => p.lat != null && p.lng != null);
  const noCoord = places.filter((p) => p.lat == null || p.lng == null);
  if (coord.length < 3) return places;
  const remaining = [...coord];
  const route: Place[] = [remaining.shift()!];
  while (remaining.length) {
    const last = route[route.length - 1];
    let bi = 0, bd = Infinity;
    remaining.forEach((p, i) => { const d = haversine(last, p); if (d < bd) { bd = d; bi = i; } });
    route.push(remaining.splice(bi, 1)[0]);
  }
  return [...route, ...noCoord];
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function dayDateLabel(start: string, dayIndex: number): string {
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d + dayIndex);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})`;
}

// 같은 날 안에서 시간순 정렬 (시간 있는 것 먼저 오름차순, 없는 것은 뒤로)
function sortByTime(arr: Place[]): Place[] {
  return [...arr].sort((a, b) => {
    if (a.planned_time && b.planned_time) return a.planned_time.localeCompare(b.planned_time);
    if (a.planned_time) return -1;
    if (b.planned_time) return 1;
    return a.order_index - b.order_index;
  });
}

type Section = { title: string; date: string; dayIndex: number | null; data: Place[] };
type Mode = "walking" | "driving";

export function ItineraryTab({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const tripId = trip.id;
  const [showSearch, setShowSearch] = useState(false);
  const [searchDay, setSearchDay] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState<Place | null>(null);
  const [mode, setMode] = useState<Mode>("walking");
  const dayCount = daysBetween(trip.start_date, trip.end_date);

  const qc = useQueryClient();
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });

  const optimizeMut = useMutation({
    mutationFn: async (dayPlaces: Place[]) => {
      const ordered = optimizeRoute(dayPlaces);
      await Promise.all(
        ordered
          .map((p, i) => (p.order_index === i ? null : placeApi.update(tripId, p.id, { order_index: i })))
          .filter(Boolean) as Promise<unknown>[]
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places", tripId] }),
  });

  const sections = useMemo<Section[]>(() => {
    const byDay: Record<string, Place[]> = {};
    (places ?? []).forEach((p) => {
      const key = p.day_index === null ? "wishlist" : String(p.day_index);
      (byDay[key] ??= []).push(p);
    });
    const result: Section[] = Array.from({ length: dayCount }, (_, i) => ({
      title: `Day ${i + 1}`,
      date: dayDateLabel(trip.start_date, i),
      dayIndex: i,
      data: sortByTime(byDay[String(i)] ?? []),
    }));
    if (byDay["wishlist"]?.length) {
      result.push({ title: "📌 가고 싶은 곳", date: "", dayIndex: null, data: byDay["wishlist"] });
    }
    return result;
  }, [trip, places, dayCount]);

  const openSearch = (day: number | null | undefined) => { setSearchDay(day); setShowSearch(true); };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>이동수단</Text>
            {(["walking", "driving"] as Mode[]).map((m) => (
              <TouchableOpacity key={m} style={[styles.modeChip, mode === m && styles.modeChipOn]} onPress={() => setMode(m)}>
                <Text style={[styles.modeChipText, mode === m && styles.modeChipTextOn]}>
                  {m === "walking" ? "🚶 도보" : "🚗 자동차"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        renderSectionHeader={({ section }) => {
          const coordCount = section.data.filter((p) => p.lat != null && p.lng != null).length;
          return (
            <View style={styles.dayHeaderRow}>
              <Text style={styles.dayHeader}>{section.title}</Text>
              {!!section.date && <Text style={styles.dayDate}>{section.date}</Text>}
              <View style={{ flex: 1 }} />
              {canEdit && coordCount >= 3 && (
                <TouchableOpacity style={styles.optBtn} onPress={() => optimizeMut.mutate(section.data)} disabled={optimizeMut.isPending}>
                  <Text style={styles.optText}>🧭 최적순서</Text>
                </TouchableOpacity>
              )}
              {canEdit && (
                <TouchableOpacity style={styles.addDayBtn} onPress={() => openSearch(section.dayIndex)}>
                  <Text style={styles.addDayText}>＋ 추가</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? <Text style={styles.emptyDay}>일정 없음 — ＋ 추가로 장소를 넣어보세요</Text> : null
        }
        renderItem={({ item, index, section }) => (
          <>
            {index > 0 && <TravelLeg from={section.data[index - 1]} to={item} mode={mode} />}
            <TouchableOpacity
              style={styles.placeCard}
              onPress={() => canEdit && setEditing(item)}
              disabled={!canEdit}
              activeOpacity={canEdit ? 0.6 : 1}
            >
              <Text style={[styles.time, !item.planned_time && styles.timeNone]}>
                {item.planned_time || "미정"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.placeName}>{item.name}</Text>
                {!!item.address && <Text style={styles.placeAddr}>{item.address}</Text>}
                {!!item.note && <Text style={styles.placeNote}>📝 {item.note}</Text>}
              </View>
              {!!item.category && <Text style={styles.tag}>{item.category}</Text>}
            </TouchableOpacity>
          </>
        )}
      />

      {canEdit && (
        <TouchableOpacity style={styles.fab} onPress={() => openSearch(undefined)}>
          <Text style={styles.fabText}>🔍 장소 검색·추가</Text>
        </TouchableOpacity>
      )}

      <PlaceSearchModal
        tripId={tripId}
        destination={trip.destination}
        dayCount={dayCount}
        defaultDay={searchDay}
        visible={showSearch}
        onClose={() => setShowSearch(false)}
      />
      <PlaceEditModal tripId={tripId} place={editing} dayCount={dayCount} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  modeLabel: { fontSize: 12, color: Colors.textMuted, marginRight: 2 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bgCardAlt },
  modeChipOn: { backgroundColor: Colors.accent },
  modeChipText: { fontSize: 12, fontWeight: "600", color: Colors.textSub },
  modeChipTextOn: { color: Colors.white },
  dayHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 8 },
  dayHeader: { fontSize: 16, fontWeight: "700", color: Colors.accentDeep },
  dayDate: { fontSize: 13, color: Colors.textSub, fontWeight: "500" },
  addDayBtn: { backgroundColor: Colors.bgCardAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addDayText: { fontSize: 13, fontWeight: "700", color: Colors.accentDeep },
  optBtn: { backgroundColor: Colors.accentDeep, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16 },
  optText: { fontSize: 13, fontWeight: "700", color: Colors.white },
  emptyDay: { color: Colors.textMuted, fontSize: 13, paddingVertical: 8, paddingLeft: 4 },
  placeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  time: { fontSize: 13, fontWeight: "700", color: Colors.accent, width: 44 },
  timeNone: { color: Colors.textMuted, fontWeight: "500" },
  placeName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  placeAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  placeNote: { fontSize: 12, color: Colors.textSub, marginTop: 4 },
  tag: { fontSize: 11, color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  fab: { position: "absolute", left: 16, right: 16, bottom: 20, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", elevation: 4 },
  fabText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});

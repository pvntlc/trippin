import React, { useEffect, useMemo, useState } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Modal, Platform, Share, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { placeApi, tripApi, expenseApi, fxApi, type Place, type Trip, type TransitOption } from "../../services/api";
import { Colors } from "../../constants/colors";
import { PlaceSearchModal } from "./PlaceSearchModal";
import { PlaceEditModal } from "./PlaceEditModal";
import { TravelLeg, type LegMode } from "./TravelLeg";
import { TransitModal } from "./TransitModal";
import { ReorderModal } from "./ReorderModal";

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

export function ItineraryTab({
  trip,
  canEdit,
  legModes,
  setLegModes,
  transitChoices,
  setTransitChoices,
}: {
  trip: Trip;
  canEdit: boolean;
  legModes: Record<string, LegMode>;
  setLegModes: React.Dispatch<React.SetStateAction<Record<string, LegMode>>>;
  transitChoices: Record<string, TransitOption>;
  setTransitChoices: React.Dispatch<React.SetStateAction<Record<string, TransitOption>>>;
}) {
  const tripId = trip.id;
  const [showSearch, setShowSearch] = useState(false);
  const [searchDay, setSearchDay] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState<Place | null>(null);
  const [transitModal, setTransitModal] = useState<{ from: Place; to: Place; key: string } | null>(null);
  const [reorderDay, setReorderDay] = useState<{ label: string; places: Place[] } | null>(null);
  const dayCount = daysBetween(trip.start_date, trip.end_date);

  const qc = useQueryClient();
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });
  const { data: weather } = useQuery({
    queryKey: ["weather", tripId],
    queryFn: () => tripApi.weather(tripId),
    staleTime: 60 * 60_000,
  });
  const wdays = weather?.days ?? [];
  const wHistorical = wdays.some((w) => w.historical);

  // 일차별 예상 경비 소계 (원화 환산)
  const { data: dayExpenses } = useQuery({ queryKey: ["expenses", tripId], queryFn: () => expenseApi.list(tripId) });
  const { data: fx } = useQuery({ queryKey: ["fx-krw"], queryFn: fxApi.krw, staleTime: 6 * 3600_000 });
  const dayKRW = useMemo(() => {
    const krwPer = fx?.krw_per ?? {};
    const m: Record<number, number> = {};
    (dayExpenses ?? []).forEach((e) => {
      if (e.day_index == null) return;
      const k = krwPer[e.currency] ? e.amount * krwPer[e.currency] : (e.currency === "KRW" ? e.amount : 0);
      m[e.day_index] = (m[e.day_index] || 0) + k;
    });
    return m;
  }, [dayExpenses, fx]);

  // 행에서 바로 삭제 (실수 방지 2단계: ✕ → 삭제?)
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: number) => placeApi.remove(tripId, id),
    onSuccess: () => { setConfirmDel(null); qc.invalidateQueries({ queryKey: ["places", tripId] }); },
  });

  // 장소를 다른 날로 이동 (행 길게 눌러 열림)
  const [moving, setMoving] = useState<Place | null>(null);
  const moveMut = useMutation({
    mutationFn: ({ id, day }: { id: number; day: number | null }) => placeApi.update(tripId, id, { day_index: day }),
    onSuccess: () => { setMoving(null); qc.invalidateQueries({ queryKey: ["places", tripId] }); },
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

  // 저장된 이동수단(place.leg_mode)을 legModes 상태에 씨딩 — 새로고침 후에도 유지.
  // 이미 있는 키(사용자가 방금 바꾼 값)는 덮어쓰지 않음.
  useEffect(() => {
    setLegModes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const sec of sections) {
        for (let i = 1; i < sec.data.length; i++) {
          const k = `${sec.data[i - 1].id}-${sec.data[i].id}`;
          const m = sec.data[i].leg_mode;
          if (m && !next[k]) { next[k] = m as LegMode; changed = true; }
        }
      }
      return changed ? next : prev;
    });
  }, [sections, setLegModes]);

  const openSearch = (day: number | null | undefined) => { setSearchDay(day); setShowSearch(true); };

  // 구글 My Maps 로 내보내기 (KML)
  const [exporting, setExporting] = useState(false);
  const notify = (m: string) => { if (Platform.OS === "web") { try { window.alert(m); } catch {} } else Alert.alert("구글맵 내보내기", m); };
  const exportToMaps = async () => {
    setExporting(true);
    try {
      const { filename, content, count } = await tripApi.exportKml(tripId);
      if (count === 0) { notify("지도에 찍을 좌표가 있는 장소가 없어요."); return; }
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([content], { type: "application/vnd.google-earth.kml+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        notify(`${count}곳을 담은 지도 파일(${filename})을 내려받았어요.\n\n구글 My Maps(mymaps.google.com) → '새 지도 만들기' → '가져오기'에서 이 파일을 올리면 모든 장소가 핀으로 떠요. 구글맵 앱에서도 열립니다.`);
      } else {
        const lines = (places ?? []).filter((p) => p.lat != null).map((p) => `• ${p.name}`);
        await Share.share({ title: trip.title, message: `${trip.title}\n\n${lines.join("\n")}\n\n구글 My Maps 에서 'KML 가져오기'로 지도에 저장하세요.` });
      }
    } catch (e: any) {
      notify(e?.message ?? "내보내기에 실패했어요.");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      {(places?.length ?? 0) > 0 && (
        <TouchableOpacity style={styles.exportBtn} onPress={exportToMaps} disabled={exporting}>
          {exporting
            ? <ActivityIndicator color={Colors.accentDeep} />
            : <Text style={styles.exportText}>🗺  구글 My Maps로 내보내기</Text>}
        </TouchableOpacity>
      )}
      {wdays.length > 0 && (
        <View style={styles.wxWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wxRow}>
            {wdays.map((w, i) => (
              <View key={w.date} style={styles.wxCard}>
                <Text style={styles.wxDay}>Day {i + 1}</Text>
                <Text style={styles.wxEmoji}>{w.emoji}</Text>
                <Text style={styles.wxTemp}>
                  {w.tmax != null ? `${w.tmax}°` : "-"}
                  <Text style={styles.wxTempMin}> / {w.tmin != null ? `${w.tmin}°` : "-"}</Text>
                </Text>
                {w.precip != null && (
                  <Text style={styles.wxRain}>{w.historical ? `☔${w.precip}mm` : `💧${w.precip}%`}</Text>
                )}
              </View>
            ))}
          </ScrollView>
          {wHistorical && <Text style={styles.wxNote}>* 예보 범위 밖 — 작년 동기(평년) 참고값</Text>}
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          const coordCount = section.data.filter((p) => p.lat != null && p.lng != null).length;
          return (
            <View style={styles.dayHeaderRow}>
              <Text style={styles.dayHeader}>{section.title}</Text>
              {!!section.date && <Text style={styles.dayDate}>{section.date}</Text>}
              {section.dayIndex !== null && dayKRW[section.dayIndex] > 0 && (
                <Text style={styles.daySpend}>💴 ₩{Math.round(dayKRW[section.dayIndex]).toLocaleString()}</Text>
              )}
              <View style={{ flex: 1 }} />
              {canEdit && section.dayIndex !== null && section.data.length >= 2 && (
                <TouchableOpacity style={styles.reorderBtn} onPress={() => setReorderDay({ label: section.title, places: section.data })}>
                  <Text style={styles.reorderText}>⇅ 순서</Text>
                </TouchableOpacity>
              )}
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
            {index > 0 && (() => {
              const prev = section.data[index - 1];
              const key = `${prev.id}-${item.id}`;
              return (
                <TravelLeg
                  from={prev}
                  to={item}
                  mode={legModes[key] ?? "walking"}
                  onMode={(m) => {
                    setLegModes((s) => ({ ...s, [key]: m }));
                    // 목적지 장소에 이동수단 저장 → 새로고침 후에도 유지
                    placeApi.update(tripId, item.id, { leg_mode: m }).catch(() => {});
                  }}
                  chosen={transitChoices[key] ?? null}
                  onOpenTransit={() => setTransitModal({ from: prev, to: item, key })}
                />
              );
            })()}
            <TouchableOpacity
              style={styles.placeCard}
              onPress={() => canEdit && setEditing(item)}
              onLongPress={() => canEdit && setMoving(item)}
              disabled={!canEdit}
              activeOpacity={canEdit ? 0.6 : 1}
            >
              <Text style={[styles.time, !item.planned_time && styles.timeNone]}>
                {item.planned_time || "미정"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.placeName}>{item.name}</Text>
                {/* 지번 주소 대신 '어떤 곳인지' 설명(note)을 작게. 탭하면 편집 가능. */}
                {!!item.note && <Text style={styles.placeAddr}>{item.note}</Text>}
              </View>
              {!!item.category && <Text style={styles.tag}>{item.category}</Text>}
              {canEdit && (
                <TouchableOpacity
                  style={styles.delBtn}
                  onPress={() => (confirmDel === item.id ? removeMut.mutate(item.id) : setConfirmDel(item.id))}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Text style={[styles.delText, confirmDel === item.id && styles.delTextConfirm]}>
                    {confirmDel === item.id ? "삭제?" : "✕"}
                  </Text>
                </TouchableOpacity>
              )}
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
        cities={trip.cities}
        dayCount={dayCount}
        defaultDay={searchDay}
        visible={showSearch}
        onClose={() => setShowSearch(false)}
      />
      <PlaceEditModal tripId={tripId} place={editing} dayCount={dayCount} onClose={() => setEditing(null)} />

      {/* 다른 날로 이동 (행 길게 누르면) */}
      <Modal visible={moving != null} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
        <TouchableOpacity style={styles.moveBg} activeOpacity={1} onPress={() => setMoving(null)}>
          <View style={styles.moveCard}>
            <Text style={styles.moveTitle} numberOfLines={1}>{moving?.name}</Text>
            <Text style={styles.moveSub}>어느 날로 옮길까요?</Text>
            <View style={styles.moveGrid}>
              {Array.from({ length: dayCount }, (_, i) => i).map((i) => (
                <TouchableOpacity key={i} style={[styles.moveChip, moving?.day_index === i && styles.moveChipOn]} onPress={() => moveMut.mutate({ id: moving!.id, day: i })}>
                  <Text style={[styles.moveChipText, moving?.day_index === i && styles.moveChipTextOn]}>Day {i + 1}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.moveChip, moving?.day_index == null && styles.moveChipOn]} onPress={() => moveMut.mutate({ id: moving!.id, day: null })}>
                <Text style={[styles.moveChipText, moving?.day_index == null && styles.moveChipTextOn]}>가고 싶은 곳</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <TransitModal
        from={transitModal?.from ?? null}
        to={transitModal?.to ?? null}
        visible={transitModal != null}
        chosen={transitModal ? transitChoices[transitModal.key] ?? null : null}
        onSelect={(o) => {
          if (transitModal) setTransitChoices((s) => ({ ...s, [transitModal.key]: o }));
          setTransitModal(null);
        }}
        onClose={() => setTransitModal(null)}
      />

      <ReorderModal
        tripId={tripId}
        dayLabel={reorderDay?.label ?? ""}
        places={reorderDay?.places ?? []}
        visible={reorderDay != null}
        onClose={() => setReorderDay(null)}
      />
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
  daySpend: { fontSize: 12, fontWeight: "800", color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  moveBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  moveCard: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 18, width: "100%", maxWidth: 360 },
  moveTitle: { fontSize: 16, fontWeight: "800", color: Colors.text },
  moveSub: { fontSize: 13, color: Colors.textSub, marginTop: 4, marginBottom: 12 },
  moveGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moveChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.bgCardAlt },
  moveChipOn: { backgroundColor: Colors.accent },
  moveChipText: { fontSize: 14, fontWeight: "700", color: Colors.textSub },
  moveChipTextOn: { color: Colors.white },
  dayDate: { fontSize: 13, color: Colors.textSub, fontWeight: "500" },
  addDayBtn: { backgroundColor: Colors.bgCardAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addDayText: { fontSize: 13, fontWeight: "700", color: Colors.accentDeep },
  optBtn: { backgroundColor: Colors.accentDeep, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16 },
  optText: { fontSize: 13, fontWeight: "700", color: Colors.white },
  reorderBtn: { backgroundColor: Colors.bgCardAlt, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16 },
  reorderText: { fontSize: 13, fontWeight: "700", color: Colors.accentDeep },
  emptyDay: { color: Colors.textMuted, fontSize: 13, paddingVertical: 8, paddingLeft: 4 },
  placeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  time: { fontSize: 13, fontWeight: "700", color: Colors.accent, width: 44 },
  timeNone: { color: Colors.textMuted, fontWeight: "500" },
  placeName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  placeAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  placeNote: { fontSize: 12, color: Colors.textSub, marginTop: 4 },
  tag: { fontSize: 11, color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  exportBtn: { marginTop: 10, marginHorizontal: 16, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.accent, borderStyle: "dashed", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  exportText: { color: Colors.accentDeep, fontSize: 13.5, fontWeight: "700" },
  wxWrap: { paddingTop: 10 },
  wxRow: { paddingHorizontal: 16, gap: 8 },
  wxCard: { alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, minWidth: 66 },
  wxDay: { fontSize: 11, color: Colors.textMuted, fontWeight: "700" },
  wxEmoji: { fontSize: 22, marginVertical: 2 },
  wxTemp: { fontSize: 13, fontWeight: "800", color: Colors.text },
  wxTempMin: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  wxRain: { fontSize: 11, color: Colors.accentDeep, fontWeight: "700", marginTop: 1 },
  wxNote: { fontSize: 11, color: Colors.textMuted, paddingHorizontal: 16, marginTop: 5 },
  delBtn: { paddingHorizontal: 4, paddingVertical: 2, marginLeft: 2 },
  delText: { fontSize: 16, color: Colors.textMuted, fontWeight: "700" },
  delTextConfirm: { fontSize: 13, color: Colors.danger, fontWeight: "800" },
  fab: { position: "absolute", left: 16, right: 16, bottom: 20, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", elevation: 4 },
  fabText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});

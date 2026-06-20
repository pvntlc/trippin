import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { mapsApi, placeApi, type PlaceSearchResult } from "../../services/api";
import { Colors } from "../../constants/colors";
import { placeTypeLabel } from "../../utils/placeTypes";

// 추천 카테고리: 표시 라벨 / 구글 검색 접두어(영문이 유명도순 결과가 좋음) / 일정 분류
const REC_CATS = [
  { label: "명소", term: "top tourist attractions in", category: "관광" },
  { label: "맛집", term: "best restaurants in", category: "식비" },
  { label: "카페", term: "popular cafes in", category: "카페" },
  { label: "쇼핑", term: "shopping areas in", category: "쇼핑" },
] as const;

// 행정구역(시·도 등) 결과 제거 — 실제 장소(establishment)만 남김
function isRealPlace(r: PlaceSearchResult): boolean {
  if (!r.types || r.types.length === 0) return true;
  return r.types.some((t) => t === "establishment" || t === "point_of_interest");
}

export function PlaceSearchModal({
  tripId,
  destination,
  dayCount,
  visible,
  onClose,
}: {
  tripId: number;
  destination: string;
  dayCount: number;
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [recCat, setRecCat] = useState(0); // REC_CATS 인덱스
  const [picked, setPicked] = useState<{ place: PlaceSearchResult; category: string } | null>(null);

  const isSearchMode = q.trim() !== "";
  const cat = REC_CATS[recCat];

  // 목적지 기준 추천 (검색어 없을 때 자동)
  const { data: recData, isFetching: recLoading } = useQuery({
    queryKey: ["recommend", destination, cat.term],
    queryFn: () => mapsApi.search(`${cat.term} ${destination}`),
    enabled: visible && !isSearchMode && !!destination,
    staleTime: 5 * 60_000,
  });

  const searchMut = useMutation({
    mutationFn: () => mapsApi.search(q.trim()),
    onSuccess: (r) => { setSearchResults(r.results); setSearched(true); },
  });

  // 선택한 장소의 리뷰 AI 요약 (분류·평점은 검색 결과에 이미 있음)
  const { data: summary, isFetching: summaryLoading } = useQuery({
    queryKey: ["placeSummary", picked?.place.google_place_id],
    queryFn: () => mapsApi.placeSummary(picked!.place.google_place_id),
    enabled: !!picked,
    staleTime: 10 * 60_000,
  });

  const addMut = useMutation({
    mutationFn: ({ place, dayIndex, category }: { place: PlaceSearchResult; dayIndex: number | null; category: string }) =>
      placeApi.add(tripId, {
        name: place.name,
        address: place.address,
        google_place_id: place.google_place_id,
        lat: place.lat,
        lng: place.lng,
        category,
        day_index: dayIndex,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["places", tripId] });
      reset();
      onClose();
    },
  });

  const reset = () => { setQ(""); setSearchResults([]); setSearched(false); setPicked(null); };

  const dayOptions: { label: string; value: number | null }[] = [
    ...Array.from({ length: dayCount }, (_, i) => ({ label: `Day ${i + 1}`, value: i as number | null })),
    { label: "가고 싶은 곳", value: null },
  ];

  const list = (isSearchMode ? searchResults : recData?.results ?? []).filter(isRealPlace);
  const loading = isSearchMode ? searchMut.isPending : recLoading;

  const renderResults = () => (
    <>
      {!isSearchMode && !!destination && (
        <View style={styles.recChips}>
          {REC_CATS.map((c, i) => (
            <TouchableOpacity key={c.label} style={[styles.recChip, recCat === i && styles.recChipOn]} onPress={() => setRecCat(i)}>
              <Text style={[styles.recChipText, recCat === i && styles.recChipTextOn]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginVertical: 24 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.google_place_id}
          style={{ maxHeight: 380 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isSearchMode
                ? (searched ? "결과가 없어요." : "")
                : (destination ? "추천 결과가 없어요." : "목적지를 설정하면 추천이 떠요. 위에서 검색해 보세요.")}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => setPicked({ place: item, category: isSearchMode ? "" : cat.category })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultAddr} numberOfLines={1}>
                  {placeTypeLabel(item.types)} · {item.address}
                </Text>
              </View>
              {item.rating != null && <Text style={styles.rating}>★ {item.rating}</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {picked ? "어느 날에 넣을까요?" : isSearchMode ? "장소 검색" : destination ? `📍 ${destination} 추천` : "장소 검색"}
            </Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          {!picked ? (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.input}
                  placeholder="직접 검색 (예: 도톤보리, 우메다 스카이빌딩)"
                  value={q}
                  onChangeText={(t) => { setQ(t); setSearched(false); }}
                  placeholderTextColor={Colors.textMuted}
                  onSubmitEditing={() => q.trim() && searchMut.mutate()}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[styles.searchBtn, !q.trim() && styles.btnOff]}
                  onPress={() => q.trim() && searchMut.mutate()}
                  disabled={!q.trim() || searchMut.isPending}
                >
                  <Text style={styles.searchBtnText}>검색</Text>
                </TouchableOpacity>
              </View>
              {renderResults()}
            </>
          ) : (
            <>
              <View style={styles.pickedBox}>
                <Text style={styles.resultName}>{picked.place.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.typeChip}>{placeTypeLabel(picked.place.types)}</Text>
                  {(summary?.rating ?? picked.place.rating) != null && (
                    <Text style={styles.ratingMeta}>
                      ★ {summary?.rating ?? picked.place.rating}
                      {!!summary?.user_ratings_total && ` (${summary.user_ratings_total.toLocaleString()})`}
                    </Text>
                  )}
                </View>
                <Text style={styles.resultAddr} numberOfLines={2}>{picked.place.address}</Text>

                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>🤖 리뷰 요약</Text>
                  {summaryLoading ? (
                    <Text style={styles.summaryLoading}>리뷰를 요약하는 중…</Text>
                  ) : summary?.review_summary ? (
                    <Text style={styles.summaryText}>{summary.review_summary}</Text>
                  ) : (
                    <Text style={styles.summaryLoading}>요약할 리뷰가 없어요.</Text>
                  )}
                </View>
              </View>
              <Text style={styles.dayPrompt}>어느 날 일정에 넣을까요?</Text>
              <View style={styles.dayGrid}>
                {dayOptions.map((d) => (
                  <TouchableOpacity
                    key={String(d.value)}
                    style={styles.dayBtn}
                    onPress={() => addMut.mutate({ place: picked.place, dayIndex: d.value, category: picked.category })}
                    disabled={addMut.isPending}
                  >
                    <Text style={styles.dayBtnText}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setPicked(null)}>
                <Text style={styles.back}>← 돌아가기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, maxHeight: "85%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text },
  close: { color: Colors.textMuted, fontSize: 14 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  input: { flex: 1, backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  searchBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center", minWidth: 64, alignItems: "center" },
  btnOff: { opacity: 0.4 },
  searchBtnText: { color: Colors.white, fontWeight: "700" },
  recChips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  recChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.bgCardAlt },
  recChipOn: { backgroundColor: Colors.accent },
  recChipText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  recChipTextOn: { color: Colors.white },
  empty: { textAlign: "center", color: Colors.textMuted, marginVertical: 24, paddingHorizontal: 20, lineHeight: 20 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  resultAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rating: { fontSize: 13, color: Colors.accentDeep, fontWeight: "600" },
  pickedBox: { backgroundColor: Colors.bgCardAlt, borderRadius: 12, padding: 14, marginBottom: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  typeChip: { fontSize: 12, fontWeight: "700", color: Colors.white, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  ratingMeta: { fontSize: 13, fontWeight: "700", color: Colors.accentDeep },
  summaryBox: { marginTop: 12, backgroundColor: Colors.bgCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  summaryLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSub, marginBottom: 6 },
  summaryText: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  summaryLoading: { fontSize: 13, color: Colors.textMuted },
  dayPrompt: { fontSize: 13, color: Colors.textSub, fontWeight: "600", marginBottom: 10 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  dayBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  dayBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  back: { color: Colors.accentDeep, fontSize: 14 },
});

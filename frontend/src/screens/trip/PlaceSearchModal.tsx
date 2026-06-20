import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mapsApi, placeApi, type PlaceSearchResult } from "../../services/api";
import { Colors } from "../../constants/colors";

export function PlaceSearchModal({
  tripId,
  dayCount,
  visible,
  onClose,
}: {
  tripId: number;
  dayCount: number;
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [picked, setPicked] = useState<PlaceSearchResult | null>(null);

  const searchMut = useMutation({
    mutationFn: () => mapsApi.search(q.trim()),
    onSuccess: (r) => setResults(r.results),
  });

  const addMut = useMutation({
    mutationFn: ({ place, dayIndex }: { place: PlaceSearchResult; dayIndex: number | null }) =>
      placeApi.add(tripId, {
        name: place.name,
        address: place.address,
        google_place_id: place.google_place_id,
        lat: place.lat,
        lng: place.lng,
        day_index: dayIndex,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["places", tripId] });
      reset();
      onClose();
    },
  });

  const reset = () => { setQ(""); setResults([]); setPicked(null); };

  const dayOptions: { label: string; value: number | null }[] = [
    ...Array.from({ length: dayCount }, (_, i) => ({ label: `Day ${i + 1}`, value: i as number | null })),
    { label: "가고 싶은 곳", value: null },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{picked ? "어느 날에 넣을까요?" : "장소 검색"}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          {!picked ? (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.input}
                  placeholder="예: 도쿄 라멘, 센소지, 시부야 카페"
                  value={q}
                  onChangeText={setQ}
                  placeholderTextColor={Colors.textMuted}
                  onSubmitEditing={() => q.trim() && searchMut.mutate()}
                  returnKeyType="search"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.searchBtn, !q.trim() && styles.btnOff]}
                  onPress={() => q.trim() && searchMut.mutate()}
                  disabled={!q.trim() || searchMut.isPending}
                >
                  {searchMut.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.searchBtnText}>검색</Text>}
                </TouchableOpacity>
              </View>

              {searchMut.isError && <Text style={styles.err}>검색에 실패했어요. 잠시 후 다시 시도해 주세요.</Text>}

              <FlatList
                data={results}
                keyExtractor={(r) => r.google_place_id}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  searchMut.isSuccess ? <Text style={styles.empty}>결과가 없어요.</Text> : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultRow} onPress={() => setPicked(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultAddr} numberOfLines={1}>{item.address}</Text>
                    </View>
                    {item.rating != null && <Text style={styles.rating}>★ {item.rating}</Text>}
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <>
              <View style={styles.pickedBox}>
                <Text style={styles.resultName}>{picked.name}</Text>
                <Text style={styles.resultAddr} numberOfLines={2}>{picked.address}</Text>
              </View>
              <View style={styles.dayGrid}>
                {dayOptions.map((d) => (
                  <TouchableOpacity
                    key={String(d.value)}
                    style={styles.dayBtn}
                    onPress={() => addMut.mutate({ place: picked, dayIndex: d.value })}
                    disabled={addMut.isPending}
                  >
                    <Text style={styles.dayBtnText}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setPicked(null)}>
                <Text style={styles.back}>← 다시 검색</Text>
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
  err: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
  empty: { textAlign: "center", color: Colors.textMuted, marginVertical: 24 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  resultAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rating: { fontSize: 13, color: Colors.accentDeep, fontWeight: "600" },
  pickedBox: { backgroundColor: Colors.bgCardAlt, borderRadius: 12, padding: 14, marginBottom: 16 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  dayBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  dayBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  back: { color: Colors.accentDeep, fontSize: 14 },
});

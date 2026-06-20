import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { placeApi, type Place } from "../../services/api";
import { Colors } from "../../constants/colors";

const CATEGORIES = ["관광", "식비", "카페", "숙박", "쇼핑", "기타"];

export function PlaceEditModal({
  tripId,
  place,
  dayCount,
  onClose,
}: {
  tripId: number;
  place: Place | null;
  dayCount: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 모달이 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (place) {
      setTime(place.planned_time ?? "");
      setCategory(place.category ?? "");
      setNote(place.note ?? "");
      setDayIndex(place.day_index);
      setConfirmDelete(false);
    }
  }, [place]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["places", tripId] });

  const saveMut = useMutation({
    mutationFn: () =>
      placeApi.update(tripId, place!.id, {
        planned_time: time.trim(),
        category,
        note: note.trim(),
        day_index: dayIndex,
      }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const removeMut = useMutation({
    mutationFn: () => placeApi.remove(tripId, place!.id),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const dayOptions: { label: string; value: number | null }[] = [
    ...Array.from({ length: dayCount }, (_, i) => ({ label: `Day ${i + 1}`, value: i as number | null })),
    { label: "가고 싶은 곳", value: null },
  ];

  return (
    <Modal visible={place != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{place?.name}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>시간</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 09:30"
              value={time}
              onChangeText={setTime}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>분류</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(category === c ? "" : c)}>
                  <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>날짜</Text>
            <View style={styles.chips}>
              {dayOptions.map((d) => (
                <TouchableOpacity key={String(d.value)} style={[styles.chip, dayIndex === d.value && styles.chipOn]} onPress={() => setDayIndex(d.value)}>
                  <Text style={[styles.chipText, dayIndex === d.value && styles.chipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>메모</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="예약 정보, 영업시간, 메모…"
              value={note}
              onChangeText={setNote}
              multiline
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, confirmDelete && styles.deleteBtnConfirm]}
              onPress={() => (confirmDelete ? removeMut.mutate() : setConfirmDelete(true))}
              disabled={removeMut.isPending}
            >
              <Text style={styles.deleteText}>
                {confirmDelete ? "한 번 더 누르면 삭제됩니다" : "일정에서 삭제"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, maxHeight: "88%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text, flex: 1, marginRight: 12 },
  close: { color: Colors.textMuted, fontSize: 14 },
  label: { fontSize: 13, color: Colors.textSub, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.bgCardAlt },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: Colors.white },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  deleteBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4, borderRadius: 10 },
  deleteBtnConfirm: { backgroundColor: "#fef2f2" },
  deleteText: { color: Colors.danger, fontSize: 14, fontWeight: "600" },
});

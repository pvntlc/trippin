import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { checklistApi, type ChecklistItem } from "../../services/api";
import { Colors } from "../../constants/colors";

export function ChecklistTab({ tripId, canEdit }: { tripId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["checklist", tripId],
    queryFn: () => checklistApi.list(tripId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["checklist", tripId] });

  const addMut = useMutation({
    mutationFn: () => checklistApi.add(tripId, text.trim()),
    onSuccess: () => { setText(""); invalidate(); },
  });
  const toggleMut = useMutation({
    mutationFn: (item: ChecklistItem) => checklistApi.update(tripId, item.id, { is_done: !item.is_done }),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => checklistApi.remove(tripId, id),
    onSuccess: invalidate,
  });

  const doneCount = (items ?? []).filter((i) => i.is_done).length;
  const total = items?.length ?? 0;

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      {total > 0 && (
        <Text style={styles.progress}>{doneCount} / {total} 완료</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>준비물을 추가해 보세요.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.check}
              onPress={() => canEdit && toggleMut.mutate(item)}
              disabled={!canEdit}
            >
              <View style={[styles.checkbox, item.is_done && styles.checkboxOn]}>
                {item.is_done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.itemText, item.is_done && styles.itemTextDone]}>{item.text}</Text>
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity onPress={() => removeMut.mutate(item.id)}>
                <Text style={styles.delete}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {canEdit && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="예: 여권, 어댑터, 멀미약…"
            value={text}
            onChangeText={setText}
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => text.trim() && addMut.mutate()}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !text.trim() && styles.addBtnOff]}
            onPress={() => text.trim() && addMut.mutate()}
            disabled={!text.trim()}
          >
            <Text style={styles.addBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  progress: { fontSize: 13, color: Colors.textSub, marginBottom: 12, fontWeight: "600" },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  check: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkMark: { color: Colors.white, fontSize: 14, fontWeight: "800" },
  itemText: { fontSize: 15, color: Colors.text, flex: 1 },
  itemTextDone: { color: Colors.textMuted, textDecorationLine: "line-through" },
  delete: { color: Colors.textMuted, fontSize: 16, paddingLeft: 12 },
  inputRow: { flexDirection: "row", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  addBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  addBtnOff: { opacity: 0.4 },
  addBtnText: { color: Colors.white, fontWeight: "700" },
});

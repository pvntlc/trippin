import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Modal, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { expenseApi, type Expense } from "../../services/api";
import { Colors } from "../../constants/colors";

const CATEGORIES = ["식비", "교통", "숙박", "관광", "쇼핑", "기타"];

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function BudgetTab({ tripId, canEdit, currency }: { tripId: number; canEdit: boolean; currency: string }) {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: () => expenseApi.list(tripId),
  });
  const { data: summary } = useQuery({
    queryKey: ["expenses-summary", tripId],
    queryFn: () => expenseApi.summary(tripId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expenses", tripId] });
    qc.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
  };

  const addMut = useMutation({
    mutationFn: () =>
      expenseApi.add(tripId, { title: title.trim(), amount: Number(amount) || 0, currency, category }),
    onSuccess: () => { setShow(false); setTitle(""); setAmount(""); invalidate(); },
    onError: (e: any) => Alert.alert("추가 실패", e?.message ?? ""),
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => expenseApi.remove(tripId, id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  const totals = summary?.by_currency ?? {};

  return (
    <View style={styles.container}>
      {/* 합계 카드 */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>총 지출</Text>
        {Object.keys(totals).length === 0 ? (
          <Text style={styles.totalValue}>0 {currency}</Text>
        ) : (
          Object.entries(totals).map(([cur, amt]) => (
            <Text key={cur} style={styles.totalValue}>{fmt(amt)} {cur}</Text>
          ))
        )}
        {summary && Object.keys(summary.by_category).length > 0 && (
          <View style={styles.catRow}>
            {Object.entries(summary.by_category).map(([cat, amt]) => (
              <Text key={cat} style={styles.catChip}>{cat} {fmt(amt)}</Text>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>지출 내역이 없어요.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {!!item.category && <Text style={styles.itemCat}>{item.category}</Text>}
            </View>
            <Text style={styles.amount}>{fmt(item.amount)} {item.currency}</Text>
            {canEdit && (
              <TouchableOpacity onPress={() => removeMut.mutate(item.id)}>
                <Text style={styles.delete}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {canEdit && (
        <TouchableOpacity style={styles.fab} onPress={() => setShow(true)}>
          <Text style={styles.fabText}>+ 지출 추가</Text>
        </TouchableOpacity>
      )}

      <Modal visible={show} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>지출 추가</Text>
            <TextInput style={styles.input} placeholder="내용 (예: 호텔 2박)" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} placeholder={`금액 (${currency})`} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <View style={styles.catPick}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.catOpt, category === c && styles.catOptOn]}>
                  <Text style={[styles.catOptText, category === c && styles.catOptTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.mBtn, styles.cancel]} onPress={() => setShow(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.confirm]} onPress={() => title.trim() && addMut.mutate()}>
                <Text style={styles.confirmText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  totalCard: { backgroundColor: Colors.accentDeep, borderRadius: 16, padding: 18, marginBottom: 16 },
  totalLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  totalValue: { color: Colors.white, fontSize: 26, fontWeight: "800", marginTop: 2 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  catChip: { color: Colors.white, fontSize: 12, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  itemTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  itemCat: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700", color: Colors.text },
  delete: { color: Colors.textMuted, fontSize: 16, paddingLeft: 6 },
  fab: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  fabText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 16 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, color: Colors.text },
  catPick: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  catOpt: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgCardAlt },
  catOptOn: { backgroundColor: Colors.accent },
  catOptText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  catOptTextOn: { color: Colors.white },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  mBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: Colors.bgCardAlt },
  cancelText: { color: Colors.textSub, fontWeight: "600" },
  confirm: { backgroundColor: Colors.accent },
  confirmText: { color: Colors.white, fontWeight: "700" },
});

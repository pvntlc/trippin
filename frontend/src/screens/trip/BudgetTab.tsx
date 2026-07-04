import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Modal, Alert, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { expenseApi, memberApi, placeApi, authApi, type Expense } from "../../services/api";
import { Colors } from "../../constants/colors";

const CATEGORIES = ["식비", "교통", "숙박", "관광", "쇼핑", "기타"];

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/* 두 좌표 간 거리(km) — 위치 기반 퀵애드용 */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function BudgetTab({ tripId, canEdit, currency, startDate, endDate }: {
  tripId: number; canEdit: boolean; currency: string; startDate?: string; endDate?: string;
}) {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [splitIds, setSplitIds] = useState<number[]>([]);
  const [atDestination, setAtDestination] = useState(false);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: () => expenseApi.list(tripId),
  });
  const { data: summary } = useQuery({
    queryKey: ["expenses-summary", tripId],
    queryFn: () => expenseApi.summary(tripId),
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me, staleTime: Infinity });
  const { data: members } = useQuery({
    queryKey: ["members", tripId],
    queryFn: () => memberApi.list(tripId),
    staleTime: 60_000,
  });
  const accepted = (members ?? []).filter(m => (m.status ?? "accepted") === "accepted");
  const nameOf = (id: number | null | undefined) =>
    accepted.find(m => m.user.id === id)?.user.name ?? "";

  /* 위치 기반 퀵애드 — 여행 기간 중 + 여행지(등록된 장소 150km 이내)면 배너 */
  const { data: places } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web" || !startDate || !endDate || !places?.length) return;
        const today = new Date().toISOString().slice(0, 10);
        if (today < startDate || today > endDate) return;
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({});
        if (!pos) return;
        const near = places.some(p => p.lat != null && p.lng != null &&
          distKm(pos.coords.latitude, pos.coords.longitude, p.lat!, p.lng!) < 150);
        setAtDestination(near);
      } catch { /* 위치 실패는 조용히 무시 */ }
    })();
  }, [tripId, startDate, endDate, places?.length]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expenses", tripId] });
    qc.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
  };

  const openAdd = () => {
    setPaidBy(me?.id ?? null);
    setSplitIds(accepted.map(m => m.user.id));   // 기본 = 전원 분담
    setShow(true);
  };

  const addMut = useMutation({
    mutationFn: () =>
      expenseApi.add(tripId, {
        title: title.trim(), amount: Number(amount) || 0, currency, category,
        paid_by: paidBy ?? undefined,
        split_user_ids: splitIds.length ? splitIds : (paidBy ? [paidBy] : []),
      }),
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
  const settlements = summary?.settlements ?? [];
  const toggleSplit = (id: number) =>
    setSplitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <View style={styles.container}>
      {/* 위치 기반 퀵애드 배너 */}
      {atDestination && canEdit && (
        <TouchableOpacity style={styles.geoBanner} onPress={openAdd}>
          <Text style={styles.geoText}>📍 지금 여행지에 있네요! 방금 쓴 비용 바로 기록하기</Text>
        </TouchableOpacity>
      )}

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

      {/* 정산 카드 — 누가 누구에게 얼마 */}
      {settlements.length > 0 && (
        <View style={styles.settleCard}>
          <Text style={styles.settleTitle}>💸 정산하기</Text>
          {settlements.map((s, i) => (
            <Text key={i} style={styles.settleLine}>
              {s.from} → {s.to}  <Text style={styles.settleAmt}>{fmt(s.amount)} {s.currency}</Text>
            </Text>
          ))}
        </View>
      )}

      <FlatList
        data={expenses}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>지출 내역이 없어요.</Text>}
        renderItem={({ item }) => {
          const split = item.split_user_ids ?? [];
          const n = split.length || (item.paid_by ? 1 : 0);
          const per = n > 1 ? item.amount / n : null;
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemCat}>
                  {item.category}
                  {item.paid_by ? ` · ${nameOf(item.paid_by) || "?"} 냄` : ""}
                  {n > 1 ? ` · ${n}명 분담` : n === 1 ? " · 혼자 부담" : ""}
                </Text>
                {per != null && (
                  <Text style={styles.perPerson}>1인당 {fmt(per)} {item.currency}</Text>
                )}
              </View>
              <Text style={styles.amount}>{fmt(item.amount)} {item.currency}</Text>
              {canEdit && (
                <TouchableOpacity onPress={() => removeMut.mutate(item.id)}>
                  <Text style={styles.delete}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {canEdit && (
        <TouchableOpacity style={styles.fab} onPress={openAdd}>
          <Text style={styles.fabText}>+ 지출 추가</Text>
        </TouchableOpacity>
      )}

      <Modal visible={show} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>지출 추가</Text>
            <TextInput style={styles.input} placeholder="내용 (예: 호텔 2박)" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} placeholder={`금액 (${currency})`} value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))} keyboardType="numeric" inputMode="decimal" placeholderTextColor={Colors.textMuted} />
            <View style={styles.catPick}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.catOpt, category === c && styles.catOptOn]}>
                  <Text style={[styles.catOptText, category === c && styles.catOptTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 누가 냈나 */}
            {accepted.length > 1 && (
              <>
                <Text style={styles.sectionLabel}>누가 냈나요?</Text>
                <View style={styles.catPick}>
                  {accepted.map((m) => (
                    <TouchableOpacity key={m.user.id} onPress={() => setPaidBy(m.user.id)}
                      style={[styles.catOpt, paidBy === m.user.id && styles.catOptOn]}>
                      <Text style={[styles.catOptText, paidBy === m.user.id && styles.catOptTextOn]}>
                        {m.user.id === me?.id ? `${m.user.name} (나)` : m.user.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>누가 함께 부담하나요? (선택된 사람끼리 1/N)</Text>
                <View style={styles.catPick}>
                  {accepted.map((m) => (
                    <TouchableOpacity key={m.user.id} onPress={() => toggleSplit(m.user.id)}
                      style={[styles.catOpt, splitIds.includes(m.user.id) && styles.catOptOn]}>
                      <Text style={[styles.catOptText, splitIds.includes(m.user.id) && styles.catOptTextOn]}>
                        {splitIds.includes(m.user.id) ? "✓ " : ""}{m.user.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {splitIds.length > 1 && Number(amount) > 0 && (
                  <Text style={styles.splitHint}>1인당 {fmt(Number(amount) / splitIds.length)} {currency}</Text>
                )}
              </>
            )}

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
  geoBanner: { backgroundColor: Colors.accent, borderRadius: 12, padding: 13, marginBottom: 10 },
  geoText: { color: Colors.white, fontWeight: "700", fontSize: 13.5, textAlign: "center" },
  totalCard: { backgroundColor: Colors.accentDeep, borderRadius: 16, padding: 18, marginBottom: 12 },
  totalLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  totalValue: { color: Colors.white, fontSize: 26, fontWeight: "800", marginTop: 2 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  catChip: { color: Colors.white, fontSize: 12, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  settleCard: { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.accent + "55" },
  settleTitle: { fontSize: 14, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  settleLine: { fontSize: 13.5, color: Colors.textSub, marginTop: 3 },
  settleAmt: { fontWeight: "800", color: Colors.accent },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  itemTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  itemCat: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  perPerson: { fontSize: 12, color: Colors.accent, fontWeight: "700", marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700", color: Colors.text },
  delete: { color: Colors.textMuted, fontSize: 16, paddingLeft: 6 },
  fab: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  fabText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 16 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, color: Colors.text },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: Colors.textSub, marginTop: 6, marginBottom: 6 },
  splitHint: { fontSize: 12.5, color: Colors.accent, fontWeight: "700", marginBottom: 4 },
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

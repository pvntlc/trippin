import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi, type Trip } from "../services/api";
import { useAuth } from "../store/auth";
import { Colors } from "../constants/colors";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Trips">;

export function TripsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: trips, isLoading } = useQuery({ queryKey: ["trips"], queryFn: tripApi.list });

  const createMut = useMutation({
    mutationFn: () =>
      tripApi.create({ title, destination, start_date: start, end_date: end, currency: "USD" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      setShowNew(false);
      setTitle(""); setDestination(""); setStart(""); setEnd("");
    },
    onError: (e: any) => Alert.alert("생성 실패", e?.message ?? ""),
  });

  const renderItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("TripDetail", { tripId: item.id, title: item.title })}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSub}>
        {item.destination || "목적지 미정"} · {item.start_date} ~ {item.end_date}
      </Text>
      <Text style={styles.cardRole}>{item.my_role === "owner" ? "내 여행" : "공유받음"}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 여행</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => String(t.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? "불러오는 중…" : "아직 여행이 없어요. + 버튼으로 새 여행을 만들어 보세요."}
          </Text>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowNew(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showNew} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>새 여행</Text>
            <TextInput style={styles.input} placeholder="여행 이름 (예: 도쿄 4박 5일)" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="목적지 (예: Tokyo)" value={destination} onChangeText={setDestination} />
            <TextInput style={styles.input} placeholder="시작일 (YYYY-MM-DD)" value={start} onChangeText={setStart} />
            <TextInput style={styles.input} placeholder="종료일 (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancel]} onPress={() => setShowNew(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirm]} onPress={() => createMut.mutate()}>
                <Text style={styles.confirmText}>만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: Colors.text },
  logout: { color: Colors.textMuted, fontSize: 14 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  cardSub: { fontSize: 14, color: Colors.textSub, marginTop: 4 },
  cardRole: { fontSize: 12, color: Colors.accentDeep, marginTop: 8 },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 60, paddingHorizontal: 32, lineHeight: 22 },
  fab: { position: "absolute", right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", elevation: 4 },
  fabText: { color: Colors.white, fontSize: 30, lineHeight: 32 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 16 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, color: Colors.text },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: Colors.bgCardAlt },
  cancelText: { color: Colors.textSub, fontWeight: "600" },
  confirm: { backgroundColor: Colors.accent },
  confirmText: { color: Colors.white, fontWeight: "700" },
});

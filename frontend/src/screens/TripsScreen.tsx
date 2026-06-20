import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi, type Trip } from "../services/api";
import { useAuth } from "../store/auth";
import { Colors } from "../constants/colors";
import { NewTripModal } from "./trip/NewTripModal";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Trips">;

export function TripsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [showNew, setShowNew] = useState(false);

  const { data: trips, isLoading } = useQuery({ queryKey: ["trips"], queryFn: tripApi.list });

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

      <NewTripModal visible={showNew} onClose={() => setShowNew(false)} />
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
});

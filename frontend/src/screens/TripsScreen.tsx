import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi, type Trip, type TripInvite } from "../services/api";
import { Colors } from "../constants/colors";
import { NewTripModal } from "./trip/NewTripModal";
import { ProfileModal } from "./ProfileModal";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Trips">;

export function TripsScreen({ navigation }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const qc = useQueryClient();
  const { data: trips, isLoading } = useQuery({ queryKey: ["trips"], queryFn: tripApi.list });
  const { data: invites } = useQuery({ queryKey: ["invites"], queryFn: tripApi.invites, refetchInterval: 60_000 });
  const inviteDone = () => {
    qc.invalidateQueries({ queryKey: ["invites"] });
    qc.invalidateQueries({ queryKey: ["trips"] });
  };
  const acceptMut = useMutation({ mutationFn: tripApi.acceptInvite, onSuccess: inviteDone });
  const declineMut = useMutation({ mutationFn: tripApi.declineInvite, onSuccess: inviteDone });

  const renderItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("TripDetail", { tripId: item.id, title: item.title })}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSub}>
        {(item.cities && item.cities.length > 1
          ? `${item.cities[0]} 외 ${item.cities.length - 1}곳`
          : item.destination || "목적지 미정")} · {item.start_date} ~ {item.end_date}
      </Text>
      <Text style={styles.cardRole}>{item.my_role === "owner" ? "내 여행" : "공유받음"}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 여행</Text>
        <TouchableOpacity onPress={() => setShowProfile(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.profileBtn}>⚙️ 프로필</Text>
        </TouchableOpacity>
      </View>

      {/* 받은 초대 — 수락해야 여행에 들어감 */}
      {(invites ?? []).map((inv: TripInvite) => (
        <View key={inv.member_id} style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>💌 {inv.invited_by}님이 초대했어요</Text>
          <Text style={styles.inviteSub}>{inv.title} · {inv.destination || "목적지 미정"} · {inv.start_date}~{inv.end_date}</Text>
          <View style={styles.inviteRow}>
            <TouchableOpacity style={styles.inviteAccept} onPress={() => acceptMut.mutate(inv.member_id)}>
              <Text style={styles.inviteAcceptText}>수락</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteDecline} onPress={() => declineMut.mutate(inv.member_id)}>
              <Text style={styles.inviteDeclineText}>거절</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

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
      <ProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: Colors.text },
  profileBtn: { color: Colors.textSub, fontSize: 14, fontWeight: "600" },
  inviteCard: { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 4, borderWidth: 1.5, borderColor: Colors.accent },
  inviteTitle: { fontSize: 15, fontWeight: "800", color: Colors.text },
  inviteSub: { fontSize: 13, color: Colors.textSub, marginTop: 3 },
  inviteRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  inviteAccept: { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  inviteAcceptText: { color: Colors.white, fontWeight: "800" },
  inviteDecline: { flex: 1, backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  inviteDeclineText: { color: Colors.textSub, fontWeight: "700" },
  card: { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  cardSub: { fontSize: 14, color: Colors.textSub, marginTop: 4 },
  cardRole: { fontSize: 12, color: Colors.accentDeep, marginTop: 8 },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 60, paddingHorizontal: 32, lineHeight: 22 },
  fab: { position: "absolute", right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", elevation: 4 },
  fabText: { color: Colors.white, fontSize: 30, lineHeight: 32 },
});

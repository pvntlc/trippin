import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi, type TransitOption } from "../services/api";
import { Colors } from "../constants/colors";
import { ItineraryTab } from "./trip/ItineraryTab";
import type { LegMode } from "./trip/TravelLeg";
import { MapTab } from "./trip/MapTab";
import { BudgetTab } from "./trip/BudgetTab";
import { ChecklistTab } from "./trip/ChecklistTab";
import { MembersModal } from "./trip/MembersModal";
import { NewTripModal } from "./trip/NewTripModal";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "TripDetail">;

const TABS = [
  { key: "itinerary", label: "일정" },
  { key: "map", label: "지도" },
  { key: "budget", label: "예산" },
  { key: "checklist", label: "준비물" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("itinerary");
  // 구간별 이동수단/선택 대중교통 — 일정 탭에서 고르고 지도 탭에서 경로로 그림
  const [legModes, setLegModes] = useState<Record<string, LegMode>>({});
  const [transitChoices, setTransitChoices] = useState<Record<string, TransitOption>>({});
  const [showMembers, setShowMembers] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: trip, isLoading } = useQuery({ queryKey: ["trip", tripId], queryFn: () => tripApi.get(tripId) });

  const deleteMut = useMutation({
    mutationFn: () => tripApi.remove(tripId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      navigation.goBack();
    },
  });

  if (isLoading || !trip) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  const canEdit = trip.my_role === "owner" || trip.my_role === "editor";
  const isOwner = trip.my_role === "owner";
  const closeActions = () => { setShowActions(false); setConfirmDelete(false); };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dest}>{trip.destination || trip.title}</Text>
          <Text style={styles.dates}>{trip.start_date} ~ {trip.end_date}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={() => setShowMembers(true)}>
          <Text style={styles.shareText}>👥 공유</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowActions(true)}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === "itinerary" && (
          <ItineraryTab
            trip={trip}
            canEdit={canEdit}
            legModes={legModes}
            setLegModes={setLegModes}
            transitChoices={transitChoices}
            setTransitChoices={setTransitChoices}
          />
        )}
        {tab === "map" && <MapTab tripId={tripId} legModes={legModes} transitChoices={transitChoices} />}
        {tab === "budget" && <BudgetTab tripId={tripId} canEdit={canEdit} currency={trip.currency} />}
        {tab === "checklist" && <ChecklistTab tripId={tripId} canEdit={canEdit} />}
      </View>

      <MembersModal tripId={tripId} canEdit={canEdit} visible={showMembers} onClose={() => setShowMembers(false)} />
      <NewTripModal visible={showEdit} editTrip={trip} onClose={() => setShowEdit(false)} />

      <Modal visible={showActions} transparent animationType="fade" onRequestClose={closeActions}>
        <TouchableOpacity style={styles.actionsBg} activeOpacity={1} onPress={closeActions}>
          <View style={styles.actionsSheet}>
            <Text style={styles.actionsTitle}>{trip.title}</Text>
            {canEdit && (
              <TouchableOpacity style={styles.editRow} onPress={() => { closeActions(); setShowEdit(true); }}>
                <Text style={styles.editRowText}>✏️  여행 정보 수정 (이름·목적지·날짜)</Text>
              </TouchableOpacity>
            )}
            {isOwner ? (
              <TouchableOpacity
                style={[styles.deleteRow, confirmDelete && styles.deleteRowConfirm]}
                onPress={() => (confirmDelete ? deleteMut.mutate() : setConfirmDelete(true))}
                disabled={deleteMut.isPending}
              >
                <Text style={[styles.deleteRowText, confirmDelete && styles.deleteRowTextConfirm]}>
                  {confirmDelete ? "한 번 더 누르면 여행이 삭제됩니다" : "🗑  여행 삭제"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.actionsNote}>여행 삭제는 소유자만 할 수 있어요.</Text>
            )}
            <TouchableOpacity style={styles.cancelRow} onPress={closeActions}>
              <Text style={styles.cancelRowText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  summary: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  dest: { fontSize: 22, fontWeight: "800", color: Colors.text },
  dates: { fontSize: 14, color: Colors.textSub, marginTop: 4 },
  shareBtn: { backgroundColor: Colors.bgCardAlt, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  shareText: { fontSize: 14, fontWeight: "600", color: Colors.accentDeep },
  moreBtn: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCardAlt },
  moreText: { fontSize: 18, fontWeight: "700", color: Colors.textSub, lineHeight: 20 },
  actionsBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  actionsSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  actionsTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 14 },
  editRow: { paddingVertical: 15, borderRadius: 12, alignItems: "center", backgroundColor: Colors.bgCardAlt, marginBottom: 8 },
  editRowText: { color: Colors.accentDeep, fontSize: 15, fontWeight: "700" },
  deleteRow: { paddingVertical: 15, borderRadius: 12, alignItems: "center", backgroundColor: "#fef2f2" },
  deleteRowConfirm: { backgroundColor: Colors.danger },
  deleteRowText: { color: Colors.danger, fontSize: 15, fontWeight: "700" },
  deleteRowTextConfirm: { color: Colors.white },
  actionsNote: { color: Colors.textMuted, fontSize: 14, paddingVertical: 12, textAlign: "center" },
  cancelRow: { paddingVertical: 14, alignItems: "center", marginTop: 6 },
  cancelRowText: { color: Colors.textSub, fontSize: 15, fontWeight: "600" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabLabel: { fontSize: 15, color: Colors.textMuted, fontWeight: "600" },
  tabLabelActive: { color: Colors.accentDeep, fontWeight: "700" },
  tabUnderline: { position: "absolute", bottom: 0, height: 2.5, width: "60%", backgroundColor: Colors.accentDeep, borderRadius: 2 },
});

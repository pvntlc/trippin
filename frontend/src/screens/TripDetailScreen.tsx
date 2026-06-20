import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi } from "../services/api";
import { Colors } from "../constants/colors";
import { ItineraryTab } from "./trip/ItineraryTab";
import { BudgetTab } from "./trip/BudgetTab";
import { ChecklistTab } from "./trip/ChecklistTab";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "TripDetail">;

const TABS = [
  { key: "itinerary", label: "일정" },
  { key: "budget", label: "예산" },
  { key: "checklist", label: "준비물" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TripDetailScreen({ route }: Props) {
  const { tripId } = route.params;
  const [tab, setTab] = useState<TabKey>("itinerary");

  const { data: trip, isLoading } = useQuery({ queryKey: ["trip", tripId], queryFn: () => tripApi.get(tripId) });

  if (isLoading || !trip) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  const canEdit = trip.my_role === "owner" || trip.my_role === "editor";

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.dest}>{trip.destination || trip.title}</Text>
        <Text style={styles.dates}>{trip.start_date} ~ {trip.end_date}</Text>
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
        {tab === "itinerary" && <ItineraryTab trip={trip} />}
        {tab === "budget" && <BudgetTab tripId={tripId} canEdit={canEdit} currency={trip.currency} />}
        {tab === "checklist" && <ChecklistTab tripId={tripId} canEdit={canEdit} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  summary: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  dest: { fontSize: 22, fontWeight: "800", color: Colors.text },
  dates: { fontSize: 14, color: Colors.textSub, marginTop: 4 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabLabel: { fontSize: 15, color: Colors.textMuted, fontWeight: "600" },
  tabLabelActive: { color: Colors.accentDeep, fontWeight: "700" },
  tabUnderline: { position: "absolute", bottom: 0, height: 2.5, width: "60%", backgroundColor: Colors.accentDeep, borderRadius: 2 },
});

import React, { useMemo } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { placeApi, type Place, type Trip } from "../../services/api";
import { Colors } from "../../constants/colors";

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

export function ItineraryTab({ trip }: { trip: Trip }) {
  const tripId = trip.id;
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });

  const sections = useMemo(() => {
    const dayCount = daysBetween(trip.start_date, trip.end_date);
    const byDay: Record<string, Place[]> = {};
    (places ?? []).forEach((p) => {
      const key = p.day_index === null ? "wishlist" : String(p.day_index);
      (byDay[key] ??= []).push(p);
    });
    const result = Array.from({ length: dayCount }, (_, i) => ({
      title: `Day ${i + 1}`,
      data: byDay[String(i)] ?? [],
    }));
    if (byDay["wishlist"]?.length) {
      result.push({ title: "📌 가고 싶은 곳 (미배치)", data: byDay["wishlist"] });
    }
    return result;
  }, [trip, places]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <Text style={styles.dayHeader}>{section.title}</Text>}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <Text style={styles.emptyDay}>일정 없음 — 장소를 추가해 보세요</Text> : null
      }
      renderItem={({ item }) => (
        <View style={styles.placeCard}>
          {!!item.planned_time && <Text style={styles.time}>{item.planned_time}</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.placeName}>{item.name}</Text>
            {!!item.address && <Text style={styles.placeAddr}>{item.address}</Text>}
          </View>
          {!!item.category && <Text style={styles.tag}>{item.category}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dayHeader: { fontSize: 16, fontWeight: "700", color: Colors.accentDeep, marginTop: 16, marginBottom: 8 },
  emptyDay: { color: Colors.textMuted, fontSize: 13, paddingVertical: 8, paddingLeft: 4 },
  placeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  time: { fontSize: 13, fontWeight: "700", color: Colors.accent, width: 44 },
  placeName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  placeAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tag: { fontSize: 11, color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
});

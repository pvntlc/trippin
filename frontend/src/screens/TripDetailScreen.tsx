import React, { useMemo } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { tripApi, placeApi, type Place } from "../services/api";
import { Colors } from "../constants/colors";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "TripDetail">;

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

export function TripDetailScreen({ route }: Props) {
  const { tripId } = route.params;

  const { data: trip } = useQuery({ queryKey: ["trip", tripId], queryFn: () => tripApi.get(tripId) });
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });

  // 날짜 수만큼 Day 섹션 구성 + 미배치(위시리스트)
  const sections = useMemo(() => {
    const dayCount = trip ? daysBetween(trip.start_date, trip.end_date) : 1;
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? <Text style={styles.emptyDay}>일정 없음</Text> : null
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
        ListHeaderComponent={
          trip ? (
            <View style={styles.summary}>
              <Text style={styles.summaryDest}>{trip.destination || trip.title}</Text>
              <Text style={styles.summaryDates}>{trip.start_date} ~ {trip.end_date}</Text>
            </View>
          ) : null
        }
      />
      {/* 지도·장소검색·이동시간·예산·체크리스트는 기능개발 단계에서 추가 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  summary: { marginBottom: 16 },
  summaryDest: { fontSize: 22, fontWeight: "800", color: Colors.text },
  summaryDates: { fontSize: 14, color: Colors.textSub, marginTop: 4 },
  dayHeader: { fontSize: 16, fontWeight: "700", color: Colors.accentDeep, marginTop: 16, marginBottom: 8, backgroundColor: Colors.bg },
  emptyDay: { color: Colors.textMuted, fontSize: 13, paddingVertical: 8, paddingLeft: 4 },
  placeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  time: { fontSize: 13, fontWeight: "700", color: Colors.accent, width: 44 },
  placeName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  placeAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tag: { fontSize: 11, color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
});

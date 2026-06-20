import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, type Place } from "../../services/api";
import { Colors } from "../../constants/colors";

const ICON: Record<string, string> = { walking: "🚶", driving: "🚗", transit: "🚇" };

/** 두 장소 사이 이동 거리·시간 표시. 좌표 없으면 렌더 안 함. */
export function TravelLeg({ from, to, mode }: { from: Place; to: Place; mode: "walking" | "driving" | "transit" }) {
  const ok = from.lat != null && from.lng != null && to.lat != null && to.lng != null;

  const { data, isFetching } = useQuery({
    queryKey: ["leg", from.id, to.id, mode],
    queryFn: () =>
      mapsApi.directions(`${from.lat},${from.lng}`, `${to.lat},${to.lng}`, mode),
    enabled: ok,
    staleTime: 30 * 60_000,
  });

  if (!ok) return null;

  let label = "…";
  if (!isFetching && data) {
    label = data.no_route || !data.duration_text
      ? "경로 정보 없음"
      : `${data.duration_text} · ${data.distance_text ?? ""}`;
  }

  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>{ICON[mode]} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 22, marginBottom: 8 },
  line: { width: 2, height: 16, backgroundColor: Colors.border, marginLeft: 6 },
  text: { fontSize: 12, color: Colors.textSub, fontWeight: "500" },
});

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, type Place } from "../../services/api";
import { Colors } from "../../constants/colors";

export type LegMode = "walking" | "transit" | "driving";
const MODES: { k: LegMode; icon: string }[] = [
  { k: "walking", icon: "🚶" },
  { k: "transit", icon: "🚇" },
  { k: "driving", icon: "🚗" },
];

/** 두 장소 사이 이동 — 구간별 교통수단 선택 + 대중교통 노선 표시. */
export function TravelLeg({
  from,
  to,
  mode,
  onMode,
}: {
  from: Place;
  to: Place;
  mode: LegMode;
  onMode: (m: LegMode) => void;
}) {
  const ok = from.lat != null && from.lng != null && to.lat != null && to.lng != null;

  const { data, isFetching } = useQuery({
    queryKey: ["leg", from.id, to.id, mode],
    queryFn: () => mapsApi.directions(`${from.lat},${from.lng}`, `${to.lat},${to.lng}`, mode),
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
  const lines = mode === "transit" && data?.transit_lines?.length ? data.transit_lines.join(" → ") : "";

  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.chips}>
        {MODES.map((m) => (
          <TouchableOpacity key={m.k} style={[styles.chip, mode === m.k && styles.chipOn]} onPress={() => onMode(m.k)}>
            <Text style={styles.chipIcon}>{m.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{label}</Text>
        {!!lines && <Text style={styles.lines}>{lines}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, marginBottom: 8 },
  line: { width: 2, height: 18, backgroundColor: Colors.border, marginLeft: 6 },
  chips: { flexDirection: "row", gap: 3 },
  chip: { width: 26, height: 24, borderRadius: 7, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: Colors.accent },
  chipIcon: { fontSize: 13 },
  text: { fontSize: 12, color: Colors.textSub, fontWeight: "500" },
  lines: { fontSize: 12, color: Colors.accentDeep, fontWeight: "600", marginTop: 1 },
});

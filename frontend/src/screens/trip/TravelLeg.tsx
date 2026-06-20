import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, type Place, type TransitOption } from "../../services/api";
import { Colors } from "../../constants/colors";

export type LegMode = "walking" | "transit" | "driving";
const MODES: { k: LegMode; icon: string }[] = [
  { k: "walking", icon: "🚶" },
  { k: "transit", icon: "🚇" },
  { k: "driving", icon: "🚗" },
];

/** 두 장소 사이 이동. 도보/자동차는 인라인 표시, 대중교통은 모달에서 선택한 경로 표시. */
export function TravelLeg({
  from,
  to,
  mode,
  onMode,
  chosen,
  onOpenTransit,
}: {
  from: Place;
  to: Place;
  mode: LegMode;
  onMode: (m: LegMode) => void;
  chosen: TransitOption | null;
  onOpenTransit: () => void;
}) {
  const ok = from.lat != null && from.lng != null && to.lat != null && to.lng != null;

  // 도보/자동차만 인라인 조회 (대중교통은 모달에서)
  const { data, isFetching } = useQuery({
    queryKey: ["leg", from.id, to.id, mode],
    queryFn: () => mapsApi.directions(`${from.lat},${from.lng}`, `${to.lat},${to.lng}`, mode),
    enabled: ok && mode !== "transit",
    staleTime: 30 * 60_000,
  });

  if (!ok) return null;

  const tapMode = (m: LegMode) => {
    onMode(m);
    if (m === "transit") onOpenTransit();
  };

  let simple = "…";
  if (mode !== "transit" && !isFetching && data) {
    simple = data.no_route || !data.duration_text ? "경로 정보 없음" : `${data.duration_text} · ${data.distance_text ?? ""}`;
  }

  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.chips}>
        {MODES.map((m) => (
          <TouchableOpacity key={m.k} style={[styles.chip, mode === m.k && styles.chipOn]} onPress={() => tapMode(m.k)}>
            <Text style={styles.chipIcon}>{m.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "transit" ? (
        <TouchableOpacity style={{ flex: 1 }} onPress={onOpenTransit}>
          {chosen ? (
            <>
              <Text style={styles.text}>
                {chosen.depart}→{chosen.arrive} · {chosen.duration_text}{chosen.fare_text ? ` · ${chosen.fare_text}` : ""}
              </Text>
              <Text style={styles.lines}>{chosen.steps.map((s) => s.line).join(" → ")}</Text>
            </>
          ) : (
            <Text style={styles.pick}>🚇 대중교통 시간 선택하기 →</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>{simple}</Text>
        </View>
      )}
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
  pick: { fontSize: 12, color: Colors.accentDeep, fontWeight: "700" },
});

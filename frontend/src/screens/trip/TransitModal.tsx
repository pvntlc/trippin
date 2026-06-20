import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, type Place, type TransitOption } from "../../services/api";
import { Colors } from "../../constants/colors";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function shift(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** 대중교통 시간대별 출발편 모달 — ◀▶로 시간 이동, 탭해서 선택. */
export function TransitModal({
  from,
  to,
  visible,
  chosen,
  onSelect,
  onClose,
}: {
  from: Place | null;
  to: Place | null;
  visible: boolean;
  chosen: TransitOption | null;
  onSelect: (o: TransitOption) => void;
  onClose: () => void;
}) {
  const [depart, setDepart] = useState<string>(from?.planned_time || nowHHMM());

  const { data, isFetching } = useQuery({
    queryKey: ["transitModal", from?.id, to?.id, depart],
    queryFn: () => mapsApi.directions(`${from!.lat},${from!.lng}`, `${to!.lat},${to!.lng}`, "transit", depart),
    enabled: visible && !!from && !!to,
    staleTime: 5 * 60_000,
  });

  const options = data?.options ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>🚇 {from?.name} → {to?.name}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          {/* 시간 이동 바 */}
          <View style={styles.timeBar}>
            <TouchableOpacity style={styles.arrow} onPress={() => setDepart(shift(depart, -15))}>
              <Text style={styles.arrowText}>◀ 이전</Text>
            </TouchableOpacity>
            <Text style={styles.timeLabel}>{depart} 이후 출발</Text>
            <TouchableOpacity style={styles.arrow} onPress={() => setDepart(shift(depart, 15))}>
              <Text style={styles.arrowText}>다음 ▶</Text>
            </TouchableOpacity>
          </View>

          {isFetching ? (
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: 30 }} />
          ) : options.length === 0 ? (
            <Text style={styles.empty}>이 시간대 경로가 없어요. ◀▶로 시간을 바꿔보세요.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {options.map((o, i) => {
                const isChosen = chosen != null && chosen.depart === o.depart && o.steps.map(s => s.line).join() === chosen.steps.map(s => s.line).join();
                return (
                  <TouchableOpacity key={i} style={[styles.opt, isChosen && styles.optChosen]} onPress={() => onSelect(o)}>
                    <View style={styles.optTop}>
                      <Text style={styles.optTime}>{o.depart} → {o.arrive}</Text>
                      <Text style={styles.optMeta}>
                        {o.duration_text}{o.fare_text ? ` · ${o.fare_text}` : ""}{o.transfers > 0 ? ` · 환승 ${o.transfers}회` : ""}
                      </Text>
                      {isChosen && <Text style={styles.chosenBadge}>선택됨 ✓</Text>}
                    </View>
                    {o.steps.map((s, j) => (
                      <Text key={j} style={styles.step}>🚃 {s.line}  {s.from_time}→{s.to_time}</Text>
                    ))}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, maxHeight: "85%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.text, flex: 1, marginRight: 12 },
  close: { color: Colors.textMuted, fontSize: 14 },
  timeBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bgCardAlt, borderRadius: 12, padding: 8, marginBottom: 12 },
  arrow: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: Colors.bgCard },
  arrowText: { fontSize: 14, fontWeight: "700", color: Colors.accentDeep },
  timeLabel: { fontSize: 15, fontWeight: "800", color: Colors.text },
  empty: { textAlign: "center", color: Colors.textMuted, marginVertical: 30, paddingHorizontal: 20, lineHeight: 20 },
  opt: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  optChosen: { borderColor: Colors.accent, backgroundColor: "#f0f9ff" },
  optTop: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  optTime: { fontSize: 16, fontWeight: "800", color: Colors.accentDeep },
  optMeta: { fontSize: 13, color: Colors.textSub, fontWeight: "600" },
  chosenBadge: { fontSize: 12, color: Colors.white, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden", fontWeight: "700" },
  step: { fontSize: 13, color: Colors.text, fontWeight: "600", marginTop: 2 },
});

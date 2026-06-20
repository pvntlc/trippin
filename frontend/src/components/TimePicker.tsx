import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

import { Colors } from "../constants/colors";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = ["00", "15", "30", "45"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 시간 선택기. value 는 "HH:MM" 또는 "" (미정). */
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value ? value.split(":") : ["", ""];
  const selH = hStr === "" ? null : Number(hStr);
  const selM = mStr === "" ? "00" : mStr;

  const setHour = (h: number) => onChange(`${pad(h)}:${value ? selM : "00"}`);
  const setMin = (m: string) => onChange(`${value ? pad(selH ?? 9) : "09"}:${m}`);

  return (
    <View>
      <View style={styles.topRow}>
        <Text style={styles.preview}>{value || "미정"}</Text>
        {!!value && (
          <TouchableOpacity onPress={() => onChange("")}>
            <Text style={styles.clear}>지우기</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sub}>시</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
        {HOURS.map((h) => (
          <TouchableOpacity key={h} style={[styles.hourChip, selH === h && styles.chipOn]} onPress={() => setHour(h)}>
            <Text style={[styles.chipText, selH === h && styles.chipTextOn]}>{pad(h)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sub}>분</Text>
      <View style={styles.minRow}>
        {MINUTES.map((m) => (
          <TouchableOpacity key={m} style={[styles.minChip, selM === m && value !== "" && styles.chipOn]} onPress={() => setMin(m)}>
            <Text style={[styles.chipText, selM === m && value !== "" && styles.chipTextOn]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { fontSize: 20, fontWeight: "800", color: Colors.accentDeep },
  clear: { fontSize: 13, color: Colors.textMuted },
  sub: { fontSize: 12, color: Colors.textMuted, marginTop: 10, marginBottom: 6 },
  hourRow: { gap: 6, paddingRight: 8 },
  hourChip: { width: 40, height: 36, borderRadius: 9, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  minRow: { flexDirection: "row", gap: 8 },
  minChip: { flex: 1, height: 38, borderRadius: 9, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: Colors.textSub },
  chipTextOn: { color: Colors.white },
});

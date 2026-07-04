import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { Colors } from "../constants/colors";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = ["00", "10", "15", "20", "30", "40", "45", "50"];
// 자주 쓰는 시간 — 한 번에 선택
const PRESETS = ["08:00", "09:00", "10:00", "12:00", "13:00", "15:00", "18:00", "20:00"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 시간 선택기(네이티브). value 는 "HH:MM" 또는 "" (미정). 웹은 TimePicker.web.tsx. */
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

      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <TouchableOpacity key={p} style={[styles.preset, value === p && styles.presetOn]} onPress={() => onChange(p)}>
            <Text style={[styles.presetText, value === p && styles.chipTextOn]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sub}>시</Text>
      <View style={styles.hourGrid}>
        {HOURS.map((h) => (
          <TouchableOpacity key={h} style={[styles.hourChip, selH === h && styles.chipOn]} onPress={() => setHour(h)}>
            <Text style={[styles.chipText, selH === h && styles.chipTextOn]}>{pad(h)}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
  preview: { fontSize: 22, fontWeight: "800", color: Colors.accentDeep },
  clear: { fontSize: 13, color: Colors.textMuted, fontWeight: "600" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  preset: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border },
  presetOn: { backgroundColor: Colors.accentDeep, borderColor: Colors.accentDeep },
  presetText: { fontSize: 13, fontWeight: "700", color: Colors.textSub },
  sub: { fontSize: 12, color: Colors.textMuted, marginTop: 14, marginBottom: 6 },
  hourGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hourChip: { width: 44, height: 36, borderRadius: 9, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  minRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  minChip: { minWidth: 44, height: 38, paddingHorizontal: 10, borderRadius: 9, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: Colors.textSub },
  chipTextOn: { color: Colors.white },
});

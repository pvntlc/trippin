import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { Colors } from "../constants/colors";

// 웹 전용 시간 선택기 — 브라우저 기본 <input type="time"> 사용 (가장 익숙하고 깔끔).
// 네이티브(iOS/Android)에서는 TimePicker.tsx(프리셋+격자)가 대신 사용됨.
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.row}>
      {/* react-native-web 은 DOM 으로 렌더되므로 실제 input[type=time] 사용 가능 */}
      <input
        type="time"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        style={{
          flex: 1,
          fontSize: 18,
          fontWeight: 700,
          color: Colors.accentDeep,
          backgroundColor: Colors.bgCardAlt,
          border: `1px solid ${Colors.border}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          outline: "none",
        }}
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChange("")} style={styles.clearBtn}>
          <Text style={styles.clear}>지우기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  clear: { fontSize: 13, color: Colors.textMuted, fontWeight: "600" },
});

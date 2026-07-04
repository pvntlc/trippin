import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, NativeSyntheticEvent, NativeScrollEvent } from "react-native";

import { Colors } from "../constants/colors";

// iOS 시간 선택기 같은 휠(wheel) — 굴리거나 탭해서 선택. 웹/네이티브 공통.
// 웹은 화면이 커서 더 컴팩트하게.
const WEB = Platform.OS === "web";
const ITEM_H = WEB ? 32 : 42;
const VISIBLE = 5;                       // 홀수: 가운데가 선택값
const PAD = ITEM_H * Math.floor(VISIBLE / 2);
const WH = ITEM_H * VISIBLE;
const MIN_STEP = 10;                     // 분 10분 단위
const MINUTES = Array.from({ length: 60 / MIN_STEP }, (_, i) => i * MIN_STEP); // 0,10,...,50
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function Wheel({ values, index, onIndex }: { values: number[]; index: number; onIndex: (i: number) => void }) {
  const ref = useRef<ScrollView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
  }, [index]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      let i = Math.round(y / ITEM_H);
      i = Math.max(0, Math.min(values.length - 1, i));
      ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
      if (i !== index) onIndex(i);
    }, 90);
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: PAD }}
    >
      {values.map((v, i) => (
        <TouchableOpacity
          key={v}
          style={styles.item}
          activeOpacity={0.6}
          onPress={() => { ref.current?.scrollTo({ y: i * ITEM_H, animated: true }); onIndex(i); }}
        >
          <Text style={[styles.itemText, i === index && styles.itemTextOn]}>{pad(v)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/** 시간 선택기. value 는 "HH:MM" 또는 "" (미정). */
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isSet = value !== "";
  const [hStr, mStr] = value ? value.split(":") : ["", ""];
  const h = hStr === "" ? 9 : Number(hStr);
  const m = mStr === "" ? 0 : Number(mStr);
  const minIdx = Math.min(MINUTES.length - 1, Math.round(m / MIN_STEP));
  const set = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`);

  return (
    <View style={WEB ? styles.webWrap : undefined}>
      <View style={styles.topRow}>
        <Text style={[styles.preview, !isSet && styles.previewOff]}>{value || "시간 미정"}</Text>
        <TouchableOpacity
          style={[styles.undecided, !isSet && styles.undecidedOn]}
          onPress={() => onChange("")}
        >
          <Text style={[styles.undecidedText, !isSet && styles.undecidedTextOn]}>미정</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.wheels, !isSet && styles.wheelsDim]}>
        <View pointerEvents="none" style={styles.centerBar} />
        <Wheel values={HOURS} index={h} onIndex={(i) => set(HOURS[i], MINUTES[minIdx])} />
        <Text style={styles.colon}>:</Text>
        <Wheel values={MINUTES} index={minIdx} onIndex={(i) => set(h, MINUTES[i])} />
      </View>
      <Text style={styles.hint}>{isSet ? "굴리거나 숫자를 눌러 조정" : "굴리면 시간이 설정돼요"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: { maxWidth: 260, alignSelf: "center", width: "100%" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { fontSize: WEB ? 20 : 24, fontWeight: "800", color: Colors.accentDeep },
  previewOff: { color: Colors.textMuted },
  undecided: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border },
  undecidedOn: { backgroundColor: Colors.accentDeep, borderColor: Colors.accentDeep },
  undecidedText: { fontSize: 12.5, fontWeight: "700", color: Colors.textSub },
  undecidedTextOn: { color: Colors.white },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: WH, marginTop: 10 },
  wheelsDim: { opacity: 0.5 },
  centerBar: {
    position: "absolute", left: WEB ? 30 : 24, right: WEB ? 30 : 24, top: PAD, height: ITEM_H,
    borderRadius: 10, backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  wheel: { width: WEB ? 60 : 74, height: WH },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: WEB ? 16 : 20, color: Colors.textMuted, fontWeight: "600" },
  itemTextOn: { fontSize: WEB ? 19 : 24, color: Colors.accentDeep, fontWeight: "800" },
  colon: { fontSize: WEB ? 20 : 26, fontWeight: "800", color: Colors.text, marginHorizontal: 6 },
  hint: { fontSize: 11.5, color: Colors.textMuted, textAlign: "center", marginTop: 8 },
});

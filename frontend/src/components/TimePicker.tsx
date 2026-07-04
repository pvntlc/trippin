import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";

import { Colors } from "../constants/colors";

// iOS 시간 선택기 같은 휠(wheel) 방식 — 위아래로 굴리거나 항목을 탭해서 선택.
// 웹/네이티브 공통 (react-native ScrollView 스냅 + 탭 폴백).
const ITEM_H = 42;
const VISIBLE = 5;                       // 홀수: 가운데가 선택값
const PAD = ITEM_H * Math.floor(VISIBLE / 2);
const WH = ITEM_H * VISIBLE;

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function Wheel({ values, index, onIndex }: { values: number[]; index: number; onIndex: (i: number) => void }) {
  const ref = useRef<ScrollView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 값(index) 변화를 스크롤 위치에 반영
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
  }, [index]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (timer.current) clearTimeout(timer.current);
    // 스크롤이 멈추면(90ms) 가장 가까운 항목으로 스냅 + 선택
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
  const [hStr, mStr] = value ? value.split(":") : ["", ""];
  const h = hStr === "" ? 9 : Number(hStr);
  const m = mStr === "" ? 0 : Number(mStr);
  const set = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 }, (_, i) => i);

  return (
    <View>
      <View style={styles.topRow}>
        <Text style={styles.preview}>{value || "시간 미정"}</Text>
        {!!value && (
          <TouchableOpacity onPress={() => onChange("")}>
            <Text style={styles.clear}>지우기</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.wheels}>
        {/* 가운데 선택 슬롯 강조 */}
        <View pointerEvents="none" style={styles.centerBar} />
        <Wheel values={hours} index={h} onIndex={(i) => set(hours[i], m)} />
        <Text style={styles.colon}>:</Text>
        <Wheel values={mins} index={m} onIndex={(i) => set(h, mins[i])} />
      </View>
      <Text style={styles.hint}>굴리거나 숫자를 눌러 시간을 정하세요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { fontSize: 24, fontWeight: "800", color: Colors.accentDeep },
  clear: { fontSize: 13, color: Colors.textMuted, fontWeight: "600" },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: WH, marginTop: 10 },
  centerBar: {
    position: "absolute", left: 20, right: 20, top: PAD, height: ITEM_H,
    borderRadius: 10, backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  wheel: { width: 74, height: WH },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 20, color: Colors.textMuted, fontWeight: "600" },
  itemTextOn: { fontSize: 24, color: Colors.accentDeep, fontWeight: "800" },
  colon: { fontSize: 26, fontWeight: "800", color: Colors.text, marginHorizontal: 6 },
  hint: { fontSize: 11.5, color: Colors.textMuted, textAlign: "center", marginTop: 8 },
});

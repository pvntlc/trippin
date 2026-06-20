import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, PanResponder, Animated } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { placeApi, type Place } from "../../services/api";
import { Colors } from "../../constants/colors";
import { computeReorder } from "./reorderLogic";

const ROW_H = 58;

/** 그 날 장소를 드래그(또는 ▲▼)로 재배치. 끌어 옮긴 항목은 시간도 자동 조정. */
export function ReorderModal({
  tripId,
  dayLabel,
  places,
  visible,
  onClose,
}: {
  tripId: number;
  dayLabel: string;
  places: Place[];
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [order, setOrder] = useState<Place[]>(places);
  const movedIds = useRef<Set<number>>(new Set());
  const [dragId, setDragId] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setOrder(places);
      movedIds.current = new Set();
      setDragId(null);
      setHoverIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const move = (from: number, to: number) => {
    setOrder((cur) => {
      if (to < 0 || to >= cur.length || from === to) return cur;
      const next = [...cur];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      movedIds.current.add(it.id);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const updates = computeReorder(places, order, movedIds.current);
      await Promise.all(updates.map((u) => placeApi.update(tripId, u.id, u)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["places", tripId] });
      onClose();
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>⇅ {dayLabel} 순서 변경</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>취소</Text></TouchableOpacity>
          </View>
          <Text style={styles.hintText}>핸들(≡)을 끌거나 ▲▼로 옮겨요. 옮긴 곳에 맞춰 시간도 자동 조정돼요.</Text>

          <View style={{ height: order.length * ROW_H, marginTop: 8 }}>
            {order.map((p, i) => (
              <Row
                key={p.id}
                place={p}
                index={i}
                count={order.length}
                isDragging={dragId === p.id}
                isHover={hoverIndex === i && dragId !== p.id}
                dragY={dragId === p.id ? dragY : null}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                onGrant={() => { setDragId(p.id); setHoverIndex(i); dragY.setValue(0); }}
                onDrag={(dy) => {
                  dragY.setValue(dy);
                  const target = Math.max(0, Math.min(order.length - 1, i + Math.round(dy / ROW_H)));
                  setHoverIndex(target);
                }}
                onRelease={(dy) => {
                  const target = Math.max(0, Math.min(order.length - 1, i + Math.round(dy / ROW_H)));
                  move(i, target);
                  setDragId(null);
                  setHoverIndex(null);
                }}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Text style={styles.saveText}>{saveMut.isPending ? "저장 중…" : "순서 저장"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  place,
  index,
  count,
  isDragging,
  isHover,
  dragY,
  onMoveUp,
  onMoveDown,
  onGrant,
  onDrag,
  onRelease,
}: {
  place: Place;
  index: number;
  count: number;
  isDragging: boolean;
  isHover: boolean;
  dragY: Animated.Value | null;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onGrant: () => void;
  onDrag: (dy: number) => void;
  onRelease: (dy: number) => void;
}) {
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onGrant(),
      onPanResponderMove: (_e, g) => onDrag(g.dy),
      onPanResponderRelease: (_e, g) => onRelease(g.dy),
      onPanResponderTerminate: (_e, g) => onRelease(g.dy),
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.row,
        { top: index * ROW_H },
        isHover && styles.rowHover,
        isDragging && styles.rowDragging,
        isDragging && dragY ? { transform: [{ translateY: dragY }], zIndex: 10, elevation: 6 } : null,
      ]}
    >
      <View style={styles.handle} {...responder.panHandlers}>
        <Text style={styles.handleIcon}>≡</Text>
      </View>
      <Text style={[styles.time, !place.planned_time && styles.timeNone]}>{place.planned_time || "미정"}</Text>
      <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
      <View style={styles.arrows}>
        <TouchableOpacity style={styles.arrowBtn} onPress={onMoveUp} disabled={index === 0}>
          <Text style={[styles.arrow, index === 0 && styles.arrowOff]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrowBtn} onPress={onMoveDown} disabled={index === count - 1}>
          <Text style={[styles.arrow, index === count - 1 && styles.arrowOff]}>▼</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, maxHeight: "85%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "800", color: Colors.text },
  close: { color: Colors.textMuted, fontSize: 14 },
  hintText: { fontSize: 12.5, color: Colors.textSub, marginTop: 8 },
  row: {
    position: "absolute", left: 0, right: 0, height: ROW_H - 8,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10,
  },
  rowHover: { borderColor: Colors.accent, borderStyle: "dashed" },
  rowDragging: { borderColor: Colors.accent, backgroundColor: "#f0f9ff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  handle: { paddingHorizontal: 6, paddingVertical: 8 },
  handleIcon: { fontSize: 20, color: Colors.textMuted, fontWeight: "700" },
  time: { fontSize: 13, fontWeight: "700", color: Colors.accent, width: 42 },
  timeNone: { color: Colors.textMuted, fontWeight: "500" },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: Colors.text },
  arrows: { flexDirection: "row", gap: 2 },
  arrowBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  arrow: { fontSize: 15, color: Colors.accentDeep, fontWeight: "800" },
  arrowOff: { color: Colors.border },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  saveText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});

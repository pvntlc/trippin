import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Calendar } from "react-native-calendars";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tripApi, mapsApi, type PlaceSearchResult, type Trip } from "../../services/api";
import { Colors } from "../../constants/colors";

const CURRENCIES = ["KRW", "JPY", "USD", "EUR"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function NewTripModal({
  visible,
  onClose,
  editTrip,
}: {
  visible: boolean;
  onClose: () => void;
  editTrip?: Trip | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!editTrip;
  const [title, setTitle] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [destQuery, setDestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(""); setCities([]); setDestQuery(""); setSuggestions([]);
    setStart(""); setEnd(""); setCurrency("USD"); setError(null);
  };

  // 수정 모드: 열릴 때 기존 값으로 채움
  useEffect(() => {
    if (visible && editTrip) {
      setTitle(editTrip.title);
      const cs = editTrip.cities && editTrip.cities.length
        ? editTrip.cities
        : (editTrip.destination ? [editTrip.destination] : []);
      setCities(cs);
      setDestQuery("");
      setStart(editTrip.start_date);
      setEnd(editTrip.end_date);
      setCurrency(editTrip.currency);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editTrip?.id]);

  // 도시 자동완성 (디바운스)
  useEffect(() => {
    const q = destQuery.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await mapsApi.search(q);
        if (alive) setSuggestions(r.results.slice(0, 5));
      } catch {
        if (alive) setSuggestions([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [destQuery]);

  const createMut = useMutation({
    mutationFn: () => {
      const data = {
        title: title.trim(),
        destination: cities[0] ?? "",
        cities,
        start_date: start, end_date: end, currency,
      };
      return isEdit ? tripApi.update(editTrip!.id, data) : tripApi.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["trip", editTrip!.id] });
      reset();
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? (isEdit ? "수정 실패" : "생성 실패")),
  });

  const submit = () => {
    if (!title.trim()) return setError("여행 이름을 입력해 주세요.");
    if (!start || !end) return setError("달력에서 시작일과 종료일을 선택해 주세요.");
    setError(null);
    createMut.mutate();
  };

  const markedDates = useMemo(() => {
    if (!start) return {};
    const marks: Record<string, any> = {};
    const last = end || start;
    let cur = start;
    while (cur <= last) {
      marks[cur] = { color: Colors.accentDeep, textColor: Colors.white };
      cur = addDays(cur, 1);
    }
    marks[start] = { startingDay: true, color: Colors.accentDeep, textColor: Colors.white };
    marks[last] = { ...(marks[last] || {}), endingDay: true, color: Colors.accentDeep, textColor: Colors.white };
    return marks;
  }, [start, end]);

  const onDayPress = (day: { dateString: string }) => {
    const ds = day.dateString;
    if (!start || (start && end)) { setStart(ds); setEnd(""); }
    else if (ds < start) { setStart(ds); }
    else { setEnd(ds); }
    setError(null);
  };

  const addCity = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setCities((prev) => (prev.includes(n) ? prev : [...prev, n]));
    setDestQuery("");
    setSuggestions([]);
    if (!title.trim() && cities.length === 0) setTitle(`${n} 여행`);
  };
  const removeCity = (name: string) => setCities((prev) => prev.filter((c) => c !== name));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{isEdit ? "여행 정보 수정" : "새 여행"}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>여행 이름</Text>
            <TextInput style={styles.input} placeholder="예: 도쿄 4박 5일" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>여행 도시 (여러 곳 추가 가능)</Text>
            {cities.length > 0 && (
              <View style={styles.cityChips}>
                {cities.map((c, i) => (
                  <View key={c} style={[styles.cityChip, i === 0 && styles.cityChipMain]}>
                    <Text style={[styles.cityChipText, i === 0 && styles.cityChipTextMain]}>
                      {i === 0 ? "★ " : ""}{c}
                    </Text>
                    <TouchableOpacity onPress={() => removeCity(c)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                      <Text style={[styles.cityChipX, i === 0 && styles.cityChipTextMain]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="도시 검색해서 추가 (예: 오사카, 교토, 나라)"
              value={destQuery}
              onChangeText={setDestQuery}
              onSubmitEditing={() => addCity(destQuery)}
              returnKeyType="done"
              placeholderTextColor={Colors.textMuted}
            />
            {searching && <Text style={styles.searching}>검색 중…</Text>}
            {suggestions.map((s) => (
              <TouchableOpacity key={s.google_place_id} style={styles.suggestion} onPress={() => addCity(s.name)}>
                <Text style={styles.sugName}>＋ {s.name}</Text>
                <Text style={styles.sugAddr} numberOfLines={1}>{s.address}</Text>
              </TouchableOpacity>
            ))}
            {cities.length > 0 && <Text style={styles.cityHint}>★ 첫 도시가 대표 도시예요. 여행 중 방문할 도시를 다 넣어보세요.</Text>}

            <Text style={styles.label}>날짜 {start ? `· ${start}${end ? ` ~ ${end}` : " ~ (종료일 선택)"}` : ""}</Text>
            <Calendar
              minDate={isEdit ? undefined : todayISO()}
              markingType="period"
              markedDates={markedDates}
              onDayPress={onDayPress}
              theme={{
                todayTextColor: Colors.accentDeep,
                arrowColor: Colors.accentDeep,
                textDayFontWeight: "500",
              }}
              style={styles.calendar}
            />

            <Text style={styles.label}>통화</Text>
            <View style={styles.chips}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipOn]} onPress={() => setCurrency(c)}>
                  <Text style={[styles.chipText, currency === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.createBtn} onPress={submit} disabled={createMut.isPending}>
              {createMut.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.createText}>{isEdit ? "저장" : "여행 만들기"}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, maxHeight: "92%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text },
  close: { color: Colors.textMuted, fontSize: 14 },
  label: { fontSize: 13, color: Colors.textSub, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  searching: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  cityChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  cityChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bgCardAlt, borderRadius: 18, paddingLeft: 12, paddingRight: 10, paddingVertical: 7 },
  cityChipMain: { backgroundColor: Colors.accent },
  cityChipText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  cityChipTextMain: { color: Colors.white },
  cityChipX: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  cityHint: { color: Colors.textMuted, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  suggestion: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sugName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  sugAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  calendar: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingBottom: 6 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.bgCardAlt },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: Colors.white },
  error: { color: Colors.danger, fontSize: 13, marginTop: 14 },
  createBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  createText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Calendar } from "react-native-calendars";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tripApi, mapsApi, type PlaceSearchResult } from "../../services/api";
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

export function NewTripModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(""); setDestination(""); setDestQuery(""); setSuggestions([]);
    setStart(""); setEnd(""); setCurrency("USD"); setError(null);
  };

  // 목적지 자동완성 (디바운스)
  useEffect(() => {
    const q = destQuery.trim();
    if (q.length < 2 || q === destination) { setSuggestions([]); return; }
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
  }, [destQuery, destination]);

  const createMut = useMutation({
    mutationFn: () =>
      tripApi.create({ title: title.trim(), destination: destination.trim(), start_date: start, end_date: end, currency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      reset();
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? "생성 실패"),
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

  const pickSuggestion = (s: PlaceSearchResult) => {
    setDestination(s.name);
    setDestQuery(s.name);
    setSuggestions([]);
    if (!title.trim()) setTitle(`${s.name} 여행`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>새 여행</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>여행 이름</Text>
            <TextInput style={styles.input} placeholder="예: 도쿄 4박 5일" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>목적지</Text>
            <TextInput
              style={styles.input}
              placeholder="도시·지역 검색 (예: 도쿄, 오사카, 파리)"
              value={destQuery}
              onChangeText={(t) => { setDestQuery(t); setDestination(""); }}
              placeholderTextColor={Colors.textMuted}
            />
            {searching && <Text style={styles.searching}>검색 중…</Text>}
            {suggestions.map((s) => (
              <TouchableOpacity key={s.google_place_id} style={styles.suggestion} onPress={() => pickSuggestion(s)}>
                <Text style={styles.sugName}>{s.name}</Text>
                <Text style={styles.sugAddr} numberOfLines={1}>{s.address}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>날짜 {start ? `· ${start}${end ? ` ~ ${end}` : " ~ (종료일 선택)"}` : ""}</Text>
            <Calendar
              minDate={todayISO()}
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
              {createMut.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.createText}>여행 만들기</Text>}
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

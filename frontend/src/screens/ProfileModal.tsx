import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi } from "../services/api";
import { useAuth } from "../store/auth";
import { Colors } from "../constants/colors";

export function ProfileModal({ visible, welcome = false, onClose }: { visible: boolean; welcome?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me, enabled: visible });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible && me) setName(me.name);
  }, [visible, me?.name]);

  const saveMut = useMutation({
    mutationFn: () => authApi.updateMe(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    onError: (e: any) => setError(e?.message ?? "저장에 실패했어요."),
  });

  const save = () => {
    setError(null);
    if (!name.trim()) return setError("닉네임을 입력해 주세요.");
    saveMut.mutate();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{welcome ? "환영해요! 🎉" : "프로필"}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>{welcome ? "나중에" : "닫기"}</Text></TouchableOpacity>
          </View>
          {welcome && <Text style={styles.welcomeMsg}>트리핀에서 쓸 닉네임을 정해주세요. 카카오 이름 그대로 써도 돼요.</Text>}

          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => { setName(t); setError(null); }}
            placeholder="닉네임"
            placeholderTextColor={Colors.textMuted}
            maxLength={100}
          />
          {!!me?.email && !me.email.endsWith("@trippin.social") && (
            <Text style={styles.emailHint}>{me.email}</Text>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          {saved && <Text style={styles.saved}>저장됐어요 ✓</Text>}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saveMut.isPending}>
            {saveMut.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>저장</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={async () => { onClose(); await logout(); }}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text },
  welcomeMsg: { fontSize: 13.5, color: Colors.textSub, marginTop: 8, lineHeight: 19 },
  close: { color: Colors.textMuted, fontSize: 14 },
  label: { fontSize: 13, color: Colors.textSub, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  emailHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 12 },
  saved: { color: Colors.accentDeep, fontSize: 13, fontWeight: "600", marginTop: 12 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  saveText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  logoutBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  logoutText: { color: Colors.danger, fontSize: 14, fontWeight: "600" },
});

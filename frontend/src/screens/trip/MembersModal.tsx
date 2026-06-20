import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { memberApi, type Member } from "../../services/api";
import { Colors } from "../../constants/colors";

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "소유자",
  editor: "편집 가능",
  viewer: "보기 전용",
};

export function MembersModal({
  tripId,
  canEdit,
  visible,
  onClose,
}: {
  tripId: number;
  canEdit: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", tripId],
    queryFn: () => memberApi.list(tripId),
    enabled: visible,
  });

  const inviteMut = useMutation({
    mutationFn: () => memberApi.invite(tripId, email.trim(), role),
    onSuccess: (m) => {
      setEmail("");
      setMsg(`${m.user.name} 님을 초대했어요.`);
      qc.invalidateQueries({ queryKey: ["members", tripId] });
    },
    onError: (e: any) => {
      // 백엔드 에러 메시지에서 의미있는 부분만 노출
      const raw = e?.message ?? "";
      setMsg(raw.includes("404") ? "해당 이메일의 가입자가 없어요." : raw.includes("409") ? "이미 멤버예요." : "초대에 실패했어요.");
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>멤버 공유</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(m) => String(m.user.id)}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <View style={styles.memberRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{item.user.name.slice(0, 1)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.user.name}</Text>
                    <Text style={styles.memberEmail}>{item.user.email}</Text>
                  </View>
                  <Text style={[styles.roleBadge, item.role === "owner" && styles.roleOwner]}>{ROLE_LABEL[item.role]}</Text>
                </View>
              )}
            />
          )}

          {canEdit && (
            <View style={styles.inviteBox}>
              <Text style={styles.inviteLabel}>이메일로 초대</Text>
              <TextInput
                style={styles.input}
                placeholder="동행자 이메일"
                value={email}
                onChangeText={(t) => { setEmail(t); setMsg(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={styles.roleRow}>
                {(["editor", "viewer"] as const).map((r) => (
                  <TouchableOpacity key={r} style={[styles.roleOpt, role === r && styles.roleOptOn]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleOptText, role === r && styles.roleOptTextOn]}>{ROLE_LABEL[r]}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.inviteBtn, !email.trim() && styles.inviteBtnOff]}
                  onPress={() => email.trim() && inviteMut.mutate()}
                  disabled={!email.trim() || inviteMut.isPending}
                >
                  <Text style={styles.inviteBtnText}>초대</Text>
                </TouchableOpacity>
              </View>
              {!!msg && <Text style={styles.msg}>{msg}</Text>}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text },
  close: { color: Colors.textMuted, fontSize: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: Colors.white, fontWeight: "700", fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  roleBadge: { fontSize: 12, color: Colors.textSub, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  roleOwner: { color: Colors.white, backgroundColor: Colors.accentDeep },
  inviteBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  inviteLabel: { fontSize: 13, color: Colors.textSub, fontWeight: "600", marginBottom: 8 },
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, marginBottom: 8 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  roleOpt: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bgCardAlt },
  roleOptOn: { backgroundColor: Colors.accent },
  roleOptText: { color: Colors.textSub, fontSize: 13, fontWeight: "600" },
  roleOptTextOn: { color: Colors.white },
  inviteBtn: { marginLeft: "auto", backgroundColor: Colors.accentDeep, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  inviteBtnOff: { opacity: 0.4 },
  inviteBtnText: { color: Colors.white, fontWeight: "700" },
  msg: { marginTop: 10, fontSize: 13, color: Colors.accentDeep },
});

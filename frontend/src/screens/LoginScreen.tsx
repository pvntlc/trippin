import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../store/auth";
import { Colors } from "../constants/colors";

export function LoginScreen() {
  const { login, register, sessionMessage } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Alert.alert 은 웹(react-native-web)에서 동작하지 않으므로 화면에 직접 표시
  const [error, setError] = useState<string | null>(null);

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const em = email.trim();
    if (!em || !password || (mode === "register" && !name.trim())) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }
    if (mode === "register") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setError("올바른 이메일 주소를 입력해 주세요.");
        return;
      }
      if (password.length < 6) {
        setError("비밀번호는 6자 이상이어야 해요.");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "login") await login(em, password);
      else await register(em, password, name.trim());
    } catch (e: any) {
      setError(e?.message ?? "실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Image source={require("../../assets/icon.png")} style={styles.logoImg} />
      <Text style={styles.logo}>Trippin</Text>
      <Text style={styles.subtitle}>해외여행 일정을 한 곳에서</Text>

      {!!sessionMessage && !error && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{sessionMessage}</Text>
        </View>
      )}

      {mode === "register" && (
        <TextInput
          style={styles.input}
          placeholder="이름"
          value={name}
          onChangeText={setName}
          placeholderTextColor={Colors.textMuted}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={Colors.textMuted}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={Colors.textMuted}
      />
      {mode === "register" && <Text style={styles.hint}>비밀번호는 6자 이상이어야 해요.</Text>}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>{mode === "login" ? "로그인" : "회원가입"}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={switchMode}>
        <Text style={styles.switch}>
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: Colors.bg },
  logoImg: { width: 84, height: 84, borderRadius: 20, alignSelf: "center", marginBottom: 14 },
  logo: { fontSize: 34, fontWeight: "800", color: Colors.accentDeep, textAlign: "center" },
  subtitle: { fontSize: 15, color: Colors.textSub, textAlign: "center", marginTop: 6, marginBottom: 32 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4 },
  noticeBox: { backgroundColor: "#eff6ff", borderColor: Colors.accent, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  noticeText: { color: Colors.accentDeep, fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  errorBox: { backgroundColor: "#fef2f2", borderColor: Colors.danger, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  errorText: { color: Colors.danger, fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  switch: { color: Colors.accentDeep, textAlign: "center", marginTop: 20, fontSize: 14 },
});

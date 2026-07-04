import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuthRequest, makeRedirectUri, ResponseType } from "expo-auth-session";

import { useAuth } from "../store/auth";
import { BASE_URL } from "../services/api";
import { Colors } from "../constants/colors";

// 웹에서 OAuth 팝업/리다이렉트 완료 처리
WebBrowser.maybeCompleteAuthSession();

const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_KEY || ""; // REST API 키 = OAuth client_id
const AUTH_ENDPOINT = "https://kauth.kakao.com/oauth/authorize";
const discovery = { authorizationEndpoint: AUTH_ENDPOINT, tokenEndpoint: "https://kauth.kakao.com/oauth/token" };

// 네이티브: 카카오는 커스텀 스킴 Redirect URI 를 안 받으므로 서버 https 브리지를 거쳐
// trippin://oauth 로 되돌아온다. 웹: 현재 origin + /oauth.
const NATIVE_RETURN = "trippin://oauth";
const BRIDGE_URI = `${BASE_URL}/auth/kakao/bridge`;

export function LoginScreen() {
  const { login, loginWithKakao, sessionMessage } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기존 이메일 회원용 (신규 가입은 없음 — 카카오만)
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 웹 전용: expo-auth-session 이 origin/oauth 로 리다이렉트를 처리
  const webRedirectUri = makeRedirectUri({ scheme: "trippin", path: "oauth" });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId: KAKAO_KEY, redirectUri: webRedirectUri, responseType: ResponseType.Code, usePKCE: false, scopes: [] },
    discovery
  );

  useEffect(() => {
    if (response?.type === "success" && response.params.code) {
      (async () => {
        setBusy(true);
        setError(null);
        try {
          await loginWithKakao(response.params.code, webRedirectUri);
        } catch (e: any) {
          setError(e?.message ?? "카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        } finally {
          setBusy(false);
        }
      })();
    } else if (response?.type === "error") {
      setError("카카오 로그인이 취소되었거나 실패했어요.");
    }
  }, [response]);

  const onKakao = async () => {
    setError(null);
    if (!KAKAO_KEY) {
      setError("카카오 로그인 설정이 아직 준비되지 않았어요.");
      return;
    }
    if (Platform.OS === "web") {
      await promptAsync();
      return;
    }
    // 네이티브: https 브리지를 redirect_uri 로 써서 인가 → 브리지가 trippin://oauth 로 딥링크
    setBusy(true);
    try {
      const authUrl =
        `${AUTH_ENDPOINT}?client_id=${encodeURIComponent(KAKAO_KEY)}` +
        `&redirect_uri=${encodeURIComponent(BRIDGE_URI)}&response_type=code`;
      const res = await WebBrowser.openAuthSessionAsync(authUrl, NATIVE_RETURN);
      if (res.type === "success" && res.url) {
        const m = res.url.match(/[?&]code=([^&]+)/);
        if (m) {
          await loginWithKakao(decodeURIComponent(m[1]), BRIDGE_URI);
        } else {
          setError("카카오 로그인이 취소되었거나 실패했어요.");
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "카카오 로그인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const onEmailLogin = async () => {
    setError(null);
    const em = email.trim();
    if (!em || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await login(em, password);
    } catch (e: any) {
      setError(e?.message ?? "로그인에 실패했어요.");
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

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* 카카오 로그인 — 기본 진입 경로 */}
      <TouchableOpacity
        style={styles.kakaoButton}
        onPress={onKakao}
        disabled={busy || !request}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color="#3C1E1E" />
        ) : (
          <Text style={styles.kakaoText}>카카오로 시작하기</Text>
        )}
      </TouchableOpacity>

      {/* 기존 이메일 회원 로그인 (신규 가입 없음) */}
      {!showEmail ? (
        <TouchableOpacity onPress={() => { setShowEmail(true); setError(null); }}>
          <Text style={styles.switch}>기존 이메일 계정으로 로그인</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.emailBox}>
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
          <TouchableOpacity style={styles.button} onPress={onEmailLogin} disabled={busy}>
            {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>로그인</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: Colors.bg },
  logoImg: { width: 84, height: 84, borderRadius: 20, alignSelf: "center", marginBottom: 14 },
  logo: { fontSize: 34, fontWeight: "800", color: Colors.accentDeep, textAlign: "center" },
  subtitle: { fontSize: 15, color: Colors.textSub, textAlign: "center", marginTop: 6, marginBottom: 32 },
  kakaoButton: {
    backgroundColor: "#FEE500",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  kakaoText: { color: "#3C1E1E", fontSize: 16, fontWeight: "700" },
  emailBox: { marginTop: 12 },
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
    marginTop: 4,
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  noticeBox: { backgroundColor: "#eff6ff", borderColor: Colors.accent, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  noticeText: { color: Colors.accentDeep, fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  errorBox: { backgroundColor: "#fef2f2", borderColor: Colors.danger, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  errorText: { color: Colors.danger, fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  switch: { color: Colors.accentDeep, textAlign: "center", marginTop: 8, fontSize: 14 },
});

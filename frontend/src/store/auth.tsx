import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState, Platform } from "react-native";

import { authApi, setAuthToken, setOnUnauthorized, tokenExpiryMs } from "../services/api";
import { getItem, setItem, deleteItem } from "../services/storage";

const TOKEN_KEY = "trippin_token";
const LAST_ACTIVITY_KEY = "trippin_last_activity";

// 미활동(아무 조작 없음) 6시간 지나면 자동 로그아웃.
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;

type LogoutReason = "manual" | "expired" | "inactive";

type AuthState = {
  token: string | null;
  loading: boolean;
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  markActivity: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastPersistRef = useRef<number>(0);

  const setTok = useCallback((t: string | null) => {
    tokenRef.current = t;
    setToken(t);
  }, []);

  // 마지막 활동 시각 갱신 (스토리지 쓰기는 30초마다로 제한)
  const markActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastPersistRef.current > 30_000) {
      lastPersistRef.current = now;
      setItem(LAST_ACTIVITY_KEY, String(now)).catch(() => {});
    }
  }, []);

  const doLogout = useCallback(async (reason: LogoutReason) => {
    setAuthToken(null);
    await deleteItem(TOKEN_KEY);
    await deleteItem(LAST_ACTIVITY_KEY);
    setTok(null);
    if (reason === "expired") setSessionMessage("세션이 만료되었어요. 다시 로그인해 주세요.");
    else if (reason === "inactive") setSessionMessage("장시간 활동이 없어 자동 로그아웃되었어요. 다시 로그인해 주세요.");
  }, [setTok]);

  // 세션 점검: 토큰 만료 또는 미활동 타임아웃이면 로그아웃
  const checkSession = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;
    const exp = tokenExpiryMs(t);
    if (exp && Date.now() >= exp) { doLogout("expired"); return; }
    if (Date.now() - lastActivityRef.current > SESSION_TIMEOUT_MS) { doLogout("inactive"); return; }
  }, [doLogout]);

  const persist = useCallback(async (newToken: string) => {
    setAuthToken(newToken);
    const now = Date.now();
    lastActivityRef.current = now;
    lastPersistRef.current = now;
    await setItem(TOKEN_KEY, newToken);
    await setItem(LAST_ACTIVITY_KEY, String(now));
    setSessionMessage(null);
    setTok(newToken);
  }, [setTok]);

  // 앱 시작 시 저장된 토큰 복원 (만료/미활동이면 복원하지 않음)
  useEffect(() => {
    (async () => {
      const saved = await getItem(TOKEN_KEY);
      if (saved) {
        const exp = tokenExpiryMs(saved);
        const lastStr = await getItem(LAST_ACTIVITY_KEY);
        const last = lastStr ? Number(lastStr) : Date.now();
        const expired = exp ? Date.now() >= exp : false;
        const inactive = Date.now() - last > SESSION_TIMEOUT_MS;
        if (expired || inactive) {
          setAuthToken(null);
          await deleteItem(TOKEN_KEY);
          await deleteItem(LAST_ACTIVITY_KEY);
          setSessionMessage(
            expired
              ? "세션이 만료되었어요. 다시 로그인해 주세요."
              : "장시간 활동이 없어 자동 로그아웃되었어요. 다시 로그인해 주세요."
          );
        } else {
          setAuthToken(saved);
          lastActivityRef.current = Date.now();
          tokenRef.current = saved;
          setToken(saved);
        }
      }
      setLoading(false);
    })();
  }, []);

  // 서버가 토큰 거부(401) → 자동 로그아웃
  useEffect(() => {
    setOnUnauthorized(() => doLogout("expired"));
    return () => setOnUnauthorized(null);
  }, [doLogout]);

  // 주기적 점검 + 활동 감지(웹 DOM 이벤트 / 앱 포그라운드 복귀)
  useEffect(() => {
    const interval = setInterval(checkSession, 30_000);

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") { checkSession(); markActivity(); }
    });

    let cleanupWeb: (() => void) | undefined;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onAct = () => markActivity();
      const onVis = () => { if (!document.hidden) checkSession(); };
      window.addEventListener("pointerdown", onAct);
      window.addEventListener("keydown", onAct);
      document.addEventListener("visibilitychange", onVis);
      cleanupWeb = () => {
        window.removeEventListener("pointerdown", onAct);
        window.removeEventListener("keydown", onAct);
        document.removeEventListener("visibilitychange", onVis);
      };
    }

    return () => {
      clearInterval(interval);
      sub.remove();
      cleanupWeb?.();
    };
  }, [checkSession, markActivity]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    await persist(access_token);
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { access_token } = await authApi.register(email, password, name);
    await persist(access_token);
  }, [persist]);

  const logout = useCallback(async () => { await doLogout("manual"); }, [doLogout]);

  return (
    <AuthContext.Provider value={{ token, loading, sessionMessage, login, register, logout, markActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

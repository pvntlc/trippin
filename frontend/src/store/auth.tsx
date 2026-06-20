import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { authApi, setAuthToken } from "../services/api";
import { getItem, setItem, deleteItem } from "../services/storage";

const TOKEN_KEY = "trippin_token";

type AuthState = {
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 저장된 토큰 복원
  useEffect(() => {
    (async () => {
      const saved = await getItem(TOKEN_KEY);
      if (saved) {
        setAuthToken(saved);
        setToken(saved);
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (newToken: string) => {
    setAuthToken(newToken);
    await setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    await persist(access_token);
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { access_token } = await authApi.register(email, password, name);
    await persist(access_token);
  }, [persist]);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await deleteItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

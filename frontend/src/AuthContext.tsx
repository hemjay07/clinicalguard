// Minimal identity auth (ADR-030). Checks the session once on mount via
// GET /auth/me (the session cookie itself is httpOnly — the frontend can't
// read it directly) and exposes the result to the whole app.

import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api/client";
import type { AuthUser } from "./types";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const u = await api.login(username, password);
    setUser(u);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

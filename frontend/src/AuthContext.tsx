// Supabase Auth (ADR-031). supabase-js owns the session (sign-in, refresh,
// OAuth callback handling); whenever a session exists we ask the backend
// who that verified identity is via GET /auth/me — which also creates/links
// the app's users row on first sign-in.

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api/client";
import { supabase } from "./supabase";
import type { AuthUser } from "./types";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveUser(hasSession: boolean) {
      if (!hasSession) {
        if (!cancelled) setUser(null);
        return;
      }
      try {
        const u = await api.me();
        if (!cancelled) setUser(u);
      } catch (e) {
        console.error(e);
        if (!cancelled) setUser(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      resolveUser(!!data.session).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        resolveUser(!!session);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

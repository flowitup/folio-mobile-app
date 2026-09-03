import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

import { api, setSessionExpiredHandler } from "@/api/client";
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "@/auth/token-storage";

import type { components } from "@/api/generated/schema";

export type AuthUser = components["schemas"]["UserResponse"];

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOutLocally = useCallback(async () => {
    await clearStoredTokens();
    setUser(null);
    setStatus("signedOut");
  }, []);

  // Restore the session on launch: a stored refresh token is enough, the client refreshes on 401.
  useEffect(() => {
    setSessionExpiredHandler(() => void signOutLocally());
    (async () => {
      const { refreshToken } = await getStoredTokens();
      if (!refreshToken) return signOutLocally();
      const { data } = await api.GET("/api/v1/auth/me");
      if (!data) return signOutLocally();
      setUser(data);
      setStatus("signedIn");
    })();
    return () => setSessionExpiredHandler(null);
  }, [signOutLocally]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error, response } = await api.POST("/api/v1/auth/login", {
      body: { email, password },
    });
    if (!data) {
      const message =
        (error as { message?: string } | undefined)?.message ??
        `HTTP ${response.status}`;
      throw new Error(message);
    }
    await setStoredTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    // Best effort server-side revocation; local sign-out must succeed even offline.
    await api.POST("/api/v1/auth/logout").catch(() => undefined);
    await signOutLocally();
  }, [signOutLocally]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

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
// The app keeps a session until the user signs out: login asks for a never-expiring
// refresh token, and sign-out hands it back so the backend revokes it for good.
const PERSISTENT_SESSION = true;

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Asks the backend to text a 6-digit code; resolves with the code's lifetime in seconds. */
  requestOtp: (phone: string) => Promise<number>;
  signInWithOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type LoginPayload = components["schemas"]["LoginResponse"];

function errorMessage(
  error: unknown,
  response: { status: number } | undefined,
): string {
  return (
    (error as { message?: string } | undefined)?.message ??
    `HTTP ${response?.status ?? "?"}`
  );
}

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

  const completeSignIn = useCallback(async (data: LoginPayload) => {
    await setStoredTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    setStatus("signedIn");
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const { data, error, response } = await api.POST(
      "/api/v1/auth/otp/request",
      { body: { phone } },
    );
    if (!data) throw new Error(errorMessage(error, response));
    return data.expires_in;
  }, []);

  const signInWithOtp = useCallback(
    async (phone: string, code: string) => {
      const { data, error, response } = await api.POST(
        "/api/v1/auth/otp/verify",
        { body: { phone, code, persistent: PERSISTENT_SESSION } },
      );
      if (!data) throw new Error(errorMessage(error, response));
      await completeSignIn(data);
    },
    [completeSignIn],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error, response } = await api.POST("/api/v1/auth/login", {
      body: { email, password, persistent: PERSISTENT_SESSION },
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
    // Best effort server-side revocation (access + refresh); local sign-out must succeed even offline.
    const { refreshToken } = await getStoredTokens();
    await api
      .POST("/api/v1/auth/logout", {
        body: { refresh_token: refreshToken },
      })
      .catch(() => undefined);
    await signOutLocally();
  }, [signOutLocally]);

  const value = useMemo(
    () => ({ status, user, signIn, requestOtp, signInWithOtp, signOut }),
    [status, user, signIn, requestOtp, signInWithOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

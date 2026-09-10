import { focusManager } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

import {
  api,
  refreshAccessToken,
  setSessionExpiredHandler,
} from "@/api/client";
import { unregisterPushDevice } from "@/features/push/push-device-registration";
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "@/auth/token-storage";

import type { components } from "@/api/generated/schema";
import i18n from "@/i18n";
import { authErrorKey } from "@/lib/auth/auth-error-message";
import type { AuthFlow } from "@/lib/auth/auth-error-message";

// `is_platform_ops` (D5) is not on the generated `UserResponse` yet — the backend ships it in
// a later phase of the roles/permissions redesign. Declared optional here so the app reads it
// as soon as it appears without another codegen round; see `src/auth/permissions.ts`.
export type AuthUser = components["schemas"]["UserResponse"] & {
  is_platform_ops?: boolean;
};
// Session lifetime is a backend setting (REFRESH_TOKEN_POLICY): "persistent" deployments
// return a never-expiring refresh token, so the app stays signed in until sign-out;
// "expiring" ones return the 7-day token. Sign-out hands the refresh token back so the
// backend revokes it either way.

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Asks the backend to text a 6-digit code; resolves with the code's lifetime in seconds. */
  requestOtp: (phone: string) => Promise<number>;
  signInWithOtp: (phone: string, code: string) => Promise<void>;
  /** Sign-up: code to a phone without an account; resolves with the code's lifetime in seconds. */
  requestSignupOtp: (phone: string) => Promise<number>;
  signUpWithOtp: (
    phone: string,
    code: string,
    displayName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetches `/auth/me` (role/grant changes apply without re-login); no-op when signed out. */
  refreshUser: () => Promise<void>;
};

type LoginPayload = components["schemas"]["LoginResponse"];

function errorMessage(
  flow: AuthFlow,
  error: unknown,
  response: { status: number } | undefined,
): string {
  // Recognised failures get a translated string; the rest keep the server's own wording,
  // which is more specific than any catch-all we could write.
  const key = authErrorKey(flow, response?.status);
  if (key) return i18n.t(key);
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

  // Shared post-login step for both the password and OTP flows. The login/OTP responses embed
  // a `user` snapshot that carries `companies` in normal operation; only fall back to a
  // `/auth/me` round trip when a payload omits it (older backend build).
  const applyLoginPayload = useCallback(async (data: LoginPayload) => {
    await setStoredTokens(data.access_token, data.refresh_token);
    if (data.user.companies) {
      setUser(data.user);
    } else {
      const { data: me } = await api.GET("/api/v1/auth/me");
      setUser(me ?? data.user);
    }
    setStatus("signedIn");
  }, []);

  // Role/grant changes apply on the backend's next request but the app caches `user` in
  // memory — refresh it whenever the app comes back to the foreground so a company admin's
  // change (role, D8 grant, new assignment) shows up without a re-login. Mints a fresh access
  // token first (`/auth/refresh` recomputes the JWT permission claim) so the `/auth/me` read
  // that follows reflects it.
  const refreshInFlight = useRef(false);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const refreshUser = useCallback(async () => {
    if (refreshInFlight.current || statusRef.current !== "signedIn") return;
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) return;
    refreshInFlight.current = true;
    try {
      await refreshAccessToken();
      const { data } = await api.GET("/api/v1/auth/me");
      if (data) setUser(data);
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  // Foreground/background also drives TanStack Query's focus manager directly (React Native has
  // no `visibilitychange` event, so the default browser-only detection never fires) — this makes
  // `useMyCompanies`/`useProjects`/directory queries refetch on foreground alongside the
  // `refreshUser` call above.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        const focused = next === "active";
        focusManager.setFocused(focused);
        if (focused) void refreshUser();
      },
    );
    return () => subscription.remove();
  }, [refreshUser]);

  const requestOtp = useCallback(async (phone: string) => {
    const { data, error, response } = await api.POST(
      "/api/v1/auth/otp/request",
      { body: { phone } },
    );
    if (!data) throw new Error(errorMessage("otp", error, response));
    return data.expires_in;
  }, []);

  const signInWithOtp = useCallback(
    async (phone: string, code: string) => {
      const { data, error, response } = await api.POST(
        "/api/v1/auth/otp/verify",
        { body: { phone, code } },
      );
      if (!data) throw new Error(errorMessage("otp", error, response));
      await applyLoginPayload(data);
    },
    [applyLoginPayload],
  );

  const requestSignupOtp = useCallback(async (phone: string) => {
    const { data, error, response } = await api.POST(
      "/api/v1/auth/signup/request",
      { body: { phone } },
    );
    if (!data) throw new Error(errorMessage("signup", error, response));
    return data.expires_in;
  }, []);

  const signUpWithOtp = useCallback(
    async (phone: string, code: string, displayName: string) => {
      const { data, error, response } = await api.POST(
        "/api/v1/auth/signup/verify",
        { body: { phone, code, display_name: displayName } },
      );
      if (!data) throw new Error(errorMessage("signup", error, response));
      await applyLoginPayload(data);
    },
    [applyLoginPayload],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error, response } = await api.POST("/api/v1/auth/login", {
        body: { email, password },
      });
      if (!data) throw new Error(errorMessage("password", error, response));
      await applyLoginPayload(data);
    },
    [applyLoginPayload],
  );

  const signOut = useCallback(async () => {
    // Best effort server-side revocation (access + refresh); local sign-out must succeed even offline.
    await unregisterPushDevice();
    const { refreshToken } = await getStoredTokens();
    await api
      .POST("/api/v1/auth/logout", {
        body: { refresh_token: refreshToken },
      })
      .catch(() => undefined);
    await signOutLocally();
  }, [signOutLocally]);

  const value = useMemo(
    () => ({
      status,
      user,
      signIn,
      requestOtp,
      signInWithOtp,
      requestSignupOtp,
      signUpWithOtp,
      signOut,
      refreshUser,
    }),
    [
      status,
      user,
      signIn,
      requestOtp,
      signInWithOtp,
      requestSignupOtp,
      signUpWithOtp,
      signOut,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

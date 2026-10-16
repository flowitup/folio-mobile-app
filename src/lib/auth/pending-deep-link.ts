import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";

type AuthStatus = "loading" | "signedIn" | "signedOut" | "unavailable";

// Screens a signed-out visitor can already open: nothing to replay after sign-in.
const OPEN_WHEN_SIGNED_OUT =
  /^\/(?:signup|login|(?:(?:fr|en|vi)\/)?accept-invite(?:\/|$)|\(auth\))/;

/**
 * The in-app path a link opens ("/projects/abc/documents?tab=x"), from any of its forms:
 * `folio://projects/abc`, `https://host/projects/abc`, `exp://host:8081/--/projects/abc`.
 * Null for the home screen and for screens that need no session.
 */
export function protectedPathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let rest = url.trim();
  const scheme = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme) {
    rest = rest.slice(scheme[0].length);
    const name = scheme[1].toLowerCase();
    // A web or dev-client URL carries a host before the path; the app scheme does not.
    if (
      name === "http" ||
      name === "https" ||
      name === "exp" ||
      name === "exps"
    ) {
      const slash = rest.indexOf("/");
      rest = slash === -1 ? "" : rest.slice(slash);
    }
  }
  rest = rest.replace(/^\/?--\//, "/");
  if (!rest.startsWith("/")) rest = `/${rest}`;
  rest = rest.split("#")[0];
  const pathname = rest.split("?")[0].replace(/\/+$/, "");
  if (pathname === "" || OPEN_WHEN_SIGNED_OUT.test(pathname)) return null;
  return rest;
}

/**
 * A link opened while signed out is held through sign-in and then opened, instead of the
 * guard dropping the visitor on the home screen (the web keeps `callbackUrl` for the same).
 * Each URL is considered once, so signing out later does not replay an old link.
 */
export function usePendingDeepLink(status: AuthStatus) {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const seen = useRef<string | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading" || !url || url === seen.current) return;
    seen.current = url;
    if (status === "signedOut") pending.current = protectedPathOf(url);
  }, [url, status]);

  useEffect(() => {
    if (status !== "signedIn" || !pending.current) return;
    const path = pending.current;
    // After the guard has swapped the signed-in group in.
    const timer = setTimeout(() => {
      pending.current = null;
      router.replace(path as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [status, router]);
}

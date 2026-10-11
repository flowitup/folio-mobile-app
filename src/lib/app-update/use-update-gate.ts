import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { API_BASE_URL } from "@/config/env";

import { isBelowMinimum } from "./version";

type PlatformPolicy = { min_version?: string; update_url?: string };
type Policy = { ios?: PlatformPolicy; android?: PlatformPolicy };

export type UpdateGate = { required: boolean; url: string; version: string };

const NONE: UpdateGate = { required: false, url: "", version: "" };

async function fetchGate(): Promise<UpdateGate> {
  const version = Constants.expoConfig?.version;
  const response = await fetch(`${API_BASE_URL}/api/v1/app-version`);
  if (!response.ok) return NONE;
  const policy = (await response.json()) as Policy;
  const mine = Platform.OS === "ios" ? policy.ios : policy.android;
  if (!mine || !isBelowMinimum(version, mine.min_version ?? "")) return NONE;
  return { required: true, url: mine.update_url ?? "", version: version ?? "" };
}

/**
 * Asks the server whether this build is too old to run. It fails open: offline, an error or a
 * malformed answer never blocks the app — only a definite "below the minimum" does. Checked at
 * launch and each time the app returns to the foreground, so a raised minimum bites quickly.
 */
export function useUpdateGate(): UpdateGate {
  const [gate, setGate] = useState<UpdateGate>(NONE);

  const check = useCallback(() => {
    fetchGate()
      .then(setGate)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [check]);

  return gate;
}

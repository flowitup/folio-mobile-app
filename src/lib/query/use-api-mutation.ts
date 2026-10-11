import {
  partialMatchKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/query/api-error";
import { apiErrorMessage } from "@/lib/query/api-error-message";

type Options<TVariables, TData> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /**
   * Query keys to refresh before the mutation resolves, so the caller sees fresh data. Every
   * other query is invalidated too (see below): this list only says which ones to wait for.
   */
  invalidates?: QueryKey[];
  /**
   * Set to false for a write that changes nothing else on screen and writes its own result into
   * the cache (a settings switch, a moderation report), so it does not refetch the whole app.
   */
  refreshAll?: boolean;
  /** Toast shown on success; omit for silent mutations. */
  successMessage?: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Custom error handling; return true to suppress the default error toast. */
  onError?: (error: unknown, variables: TVariables) => boolean | void;
};

/**
 * Mutation wrapper enforcing the app-wide conventions: refresh the data after a write, toast on
 * success when asked, toast a message for the error, in the UI language, on failure.
 *
 * A write can change figures on screens whose query keys nobody listed (a task or an invoice
 * moves Home's totals, the project list, the bell). Listing keys by hand kept missing one and
 * leaving a screen stale until the app restarted, so on success every query is invalidated:
 * the ones on screen refetch now, the rest refetch the next time they are shown.
 */
export function useApiMutation<TVariables = void, TData = unknown>(
  options: Options<TVariables, TData>,
) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      const awaited = options.invalidates ?? [];
      if (options.refreshAll !== false)
        void queryClient.invalidateQueries({
          predicate: (query) =>
            !awaited.some((key) => partialMatchKey(query.queryKey, key)),
        });
      await Promise.all(
        awaited.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      if (options.successMessage) showToast(options.successMessage, "success");
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (__DEV__ && !(error instanceof ApiError))
        console.error("[useApiMutation]", error);
      if (options.onError?.(error, variables) === true) return;
      showToast(apiErrorMessage(error, t, i18n.language), "error");
    },
  });
}

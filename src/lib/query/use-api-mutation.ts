import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/query/api-error";

type Options<TVariables, TData> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate on success. */
  invalidates?: QueryKey[];
  /** Toast shown on success; omit for silent mutations. */
  successMessage?: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Custom error handling; return true to suppress the default error toast. */
  onError?: (error: unknown, variables: TVariables) => boolean | void;
};

/**
 * Mutation wrapper enforcing the app-wide conventions: invalidate the listed queries,
 * toast on success when asked, toast the API error message on failure.
 */
export function useApiMutation<TVariables = void, TData = unknown>(
  options: Options<TVariables, TData>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(
        (options.invalidates ?? []).map((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        ),
      );
      if (options.successMessage) showToast(options.successMessage, "success");
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (__DEV__ && !(error instanceof ApiError))
        console.error("[useApiMutation]", error);
      if (options.onError?.(error, variables) === true) return;
      const message =
        error instanceof ApiError ? error.message : t("common.networkError");
      showToast(message, "error");
    },
  });
}

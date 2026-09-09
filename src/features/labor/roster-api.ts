import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";

import type { components } from "@/api/generated/schema";

/** One worker's day on the roster (D3 whitelist: name, presence, hours, day type — never pay). */
export type RosterRow = components["schemas"]["RosterRowResponse"];

export const rosterKeys = {
  /** Every cached day of the project's roster — what an attendance mutation invalidates. */
  all: (projectId: string) =>
    ["projects", projectId, "labor", "roster"] as const,
  day: (projectId: string, date: string) =>
    ["projects", projectId, "labor", "roster", date] as const,
};

/** Day roster for a project — every project member sees it, workers included (D3). */
export function useRoster(projectId: string | undefined, date: string) {
  return useQuery({
    queryKey: rosterKeys.day(projectId ?? "", date),
    enabled: Boolean(projectId && date),
    queryFn: async () =>
      unwrapAs<components["schemas"]["RosterResponse"]>(
        await api.GET("/api/v1/projects/{project_id}/labor/roster", {
          params: {
            path: { project_id: projectId! },
            query: { date },
          },
        }),
      ).rows,
  });
}

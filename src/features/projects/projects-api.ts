import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrap } from "@/lib/query/api-error";

// The projects list and detail responses are not typed in the OpenAPI spec yet;
// this mirrors the JSON the backend returns today.
export type ProjectSummary = {
  id: string;
  name: string;
  address?: string | null;
  budget?: number | null;
  budget_source?: string | null;
  invoice_prefix?: string | null;
  company_id?: string | null;
  owner_id?: string;
  user_count?: number;
  spent?: number;
  spent_personal?: number;
  spent_by_credits?: number;
  labor_accrued?: number;
  labor_paid?: number;
  labor_unpaid?: number;
  my_permissions?: string[];
  created_at?: string;
};

export type ProjectsListResponse = {
  projects: ProjectSummary[];
  total: number;
};

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/projects"),
      ) as unknown as ProjectsListResponse,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/projects/{project_id}", {
          params: { path: { project_id: id! } },
        }),
      ) as unknown as ProjectSummary,
  });
}

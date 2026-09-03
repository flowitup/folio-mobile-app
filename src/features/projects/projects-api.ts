import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrap } from "@/lib/query/api-error";

import type { components } from "@/api/generated/schema";

/** Detail shape from the spec; the list endpoint returns the same rows but is not annotated yet. */
export type Project = components["schemas"]["ProjectResponse"];

export type ProjectsListResponse = { projects: Project[]; total: number };

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

function asProjectsList(data: unknown): ProjectsListResponse {
  const body = data as Partial<ProjectsListResponse> | undefined;
  const projects = Array.isArray(body?.projects) ? body.projects : [];
  return {
    projects,
    total: typeof body?.total === "number" ? body.total : projects.length,
  };
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () =>
      asProjectsList(unwrap(await api.GET("/api/v1/projects"))),
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
      ),
  });
}

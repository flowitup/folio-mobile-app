import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrap, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

/** Detail shape from the spec; the list endpoint returns the same rows but is not annotated yet. */
export type Project = components["schemas"]["ProjectResponse"];
export type CreateProjectInput = components["schemas"]["CreateProjectRequest"];
export type UpdateProjectInput = components["schemas"]["UpdateProjectRequest"];

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

export function useCreateProject() {
  const { t } = useTranslation();
  return useApiMutation<CreateProjectInput, Project>({
    mutationFn: async (body) =>
      unwrap(await api.POST("/api/v1/projects", { body })),
    invalidates: [projectKeys.all],
    successMessage: t("project.created"),
  });
}

export function useUpdateProject(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<UpdateProjectInput, Project>({
    mutationFn: async (body) =>
      unwrap(
        await api.PUT("/api/v1/projects/{project_id}", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [projectKeys.all, projectKeys.detail(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteProject(projectId: string) {
  const { t } = useTranslation();
  const router = useRouter();
  return useApiMutation<void, void>({
    mutationFn: async () =>
      unwrapVoid(
        await api.DELETE("/api/v1/projects/{project_id}", {
          params: { path: { project_id: projectId } },
        }),
      ),
    invalidates: [projectKeys.all],
    successMessage: t("project.deleted"),
    onSuccess: () => router.navigate("/(app)/(tabs)"),
  });
}

/** Project-scoped permission check with the JWT-wide list as fallback (same strings as the web). */
export function projectCan(
  project: Project | undefined,
  permission: string,
  globalPermissions: string[] = [],
): boolean {
  const scoped = project?.my_permissions ?? [];
  const matches = (list: string[]) =>
    list.includes(permission) ||
    list.includes("*:*") ||
    list.includes(`${permission.split(":")[0]}:*`);
  return matches(scoped) || matches(globalPermissions);
}

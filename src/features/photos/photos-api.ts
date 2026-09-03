import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";

// Shape mirrors project_photos/routes.py `_serialize`; not annotated in the spec.
export type ProjectPhoto = {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  caption: string | null;
  captured_at: string;
  uploaded_at: string;
  uploader_id: string;
  thumbnail_url: string;
  original_url: string;
};

export type PhotosPage = {
  items: ProjectPhoto[];
  total: number;
  page: number;
  per_page: number;
};

export const photoKeys = {
  list: (projectId: string, page = 1) =>
    ["projects", projectId, "photos", page] as const,
};

export function useProjectPhotos(projectId: string, page = 1) {
  return useQuery({
    queryKey: photoKeys.list(projectId, page),
    queryFn: async () =>
      unwrapAs<PhotosPage>(
        await api.GET("/api/v1/projects/{project_id}/photos", {
          params: { path: { project_id: projectId }, query: { page } as never },
        }),
      ),
  });
}

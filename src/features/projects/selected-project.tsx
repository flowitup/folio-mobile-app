import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

import { useProjects } from "@/features/projects/projects-api";
import type { Project } from "@/features/projects/projects-api";

// Same key the previous dashboard used, so an upgrade keeps the user's project.
const PROJECT_KEY = "folio.dashboard.project";

type SelectedProjectValue = {
  projects: Project[];
  project: Project | undefined;
  /** Empty string while nothing is selected (no projects yet, or still loading). */
  projectId: string;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  select: (id: string) => void;
};

const SelectedProjectContext = createContext<SelectedProjectValue | null>(null);

// Project chosen from outside the shell (a tapped push names its project).
let pendingProjectId: string | null = null;
let mountedSelect: ((id: string) => void) | null = null;
export function selectProjectOnNextShell(id: string): void {
  if (mountedSelect) mountedSelect(id);
  else pendingProjectId = id;
}

/**
 * The project the shell is showing: picked in the top-bar switcher, persisted across launches,
 * falls back to the first project of the list. Every tab reads it instead of a route param.
 */
export function SelectedProjectProvider({ children }: PropsWithChildren) {
  const projects = useProjects();
  const [stored, setStored] = useState<string | null>(null);
  // A project asked for before the shell mounted (tapped push) wins over the stored one.
  const [chosen, setChosen] = useState<string | null>(() => {
    const initial = pendingProjectId;
    pendingProjectId = null;
    return initial;
  });

  useEffect(() => {
    SecureStore.getItemAsync(PROJECT_KEY)
      .catch(() => null)
      .then((value) => setStored(value));
  }, []);

  const select = useCallback((id: string) => {
    setChosen(id);
    void SecureStore.setItemAsync(PROJECT_KEY, id).catch(() => undefined);
  }, []);
  useEffect(() => {
    mountedSelect = select;
    return () => {
      mountedSelect = null;
    };
  }, [select]);

  const list = useMemo(() => projects.data?.projects ?? [], [projects.data]);
  const project =
    list.find((p) => p.id === chosen) ??
    list.find((p) => p.id === stored) ??
    list[0];

  const value = useMemo<SelectedProjectValue>(
    () => ({
      projects: list,
      project,
      projectId: project?.id ?? "",
      isPending: projects.isPending,
      isError: projects.isError,
      refetch: () => void projects.refetch(),
      select,
    }),
    [list, project, projects, select],
  );

  return (
    <SelectedProjectContext.Provider value={value}>
      {children}
    </SelectedProjectContext.Provider>
  );
}

export function useSelectedProject(): SelectedProjectValue {
  const context = useContext(SelectedProjectContext);
  if (!context)
    throw new Error(
      "useSelectedProject must be used inside SelectedProjectProvider",
    );
  return context;
}

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface WorkspaceLite {
  id: string;
  name: string;
  status: string;
  owner_id: string | null;
}

export interface ProjectLite {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  source_type: "documentation" | "zip" | "github";
}

interface WorkspaceContextValue {
  workspaces: WorkspaceLite[];
  projects: ProjectLite[];
  currentWorkspace: WorkspaceLite | null;
  currentProject: ProjectLite | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const LS_WS = "qap.currentWorkspaceId";
const LS_PROJ = "qap.currentProjectId";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string | null>(
    () => localStorage.getItem(LS_WS)
  );
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    () => localStorage.getItem(LS_PROJ)
  );
  const [loading, setLoading] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);

  const persistToProfile = useCallback(
    async (patch: { last_workspace_id?: string | null; last_project_id?: string | null }) => {
      if (!user?.id) return;
      try {
        await supabase.from("profiles").update(patch).eq("id", user.id);
      } catch {
        /* non-blocking */
      }
    },
    [user?.id],
  );

  const setCurrentWorkspaceId = useCallback((id: string | null) => {
    setCurrentWorkspaceIdState(id);
    if (id) localStorage.setItem(LS_WS, id);
    else localStorage.removeItem(LS_WS);
    setCurrentProjectIdState(null);
    localStorage.removeItem(LS_PROJ);
    persistToProfile({ last_workspace_id: id, last_project_id: null });
  }, [persistToProfile]);

  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) localStorage.setItem(LS_PROJ, id);
    else localStorage.removeItem(LS_PROJ);
    persistToProfile({ last_project_id: id });
  }, [persistToProfile]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setWorkspaces([]);
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      // RLS on workspaces already restricts rows to member/owner
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id,name,status,owner_id")
        .order("created_at", { ascending: false });
      const list = (ws || []) as WorkspaceLite[];
      setWorkspaces(list);

      // Prefer profile.last_* on first hydration
      let preferredWs = currentWorkspaceId;
      let preferredProj = currentProjectId;
      if (!profileHydrated) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("last_workspace_id,last_project_id")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.last_workspace_id) preferredWs = prof.last_workspace_id;
        if (prof?.last_project_id) preferredProj = prof.last_project_id;
        setProfileHydrated(true);
      }

      let activeWs = preferredWs;
      if (!activeWs || !list.find((w) => w.id === activeWs)) {
        activeWs = list[0]?.id || null;
      }
      setCurrentWorkspaceIdState(activeWs);
      if (activeWs) localStorage.setItem(LS_WS, activeWs);
      else localStorage.removeItem(LS_WS);

      if (activeWs) {
        const { data: pr } = await supabase
          .from("projects")
          .select("id,workspace_id,name,status,source_type")
          .eq("workspace_id", activeWs)
          .order("created_at", { ascending: false });
        const plist = (pr || []) as ProjectLite[];
        setProjects(plist);
        const nextProj = preferredProj && plist.find((p) => p.id === preferredProj)
          ? preferredProj
          : (plist[0]?.id || null);
        setCurrentProjectIdState(nextProj);
        if (nextProj) localStorage.setItem(LS_PROJ, nextProj);
        else localStorage.removeItem(LS_PROJ);
      } else {
        setProjects([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, currentWorkspaceId, currentProjectId, profileHydrated]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // when workspace changes, fetch its projects
  useEffect(() => {
    if (!currentWorkspaceId) {
      setProjects([]);
      return;
    }
    supabase
      .from("projects")
      .select("id,workspace_id,name,status,source_type")
      .eq("workspace_id", currentWorkspaceId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects((data || []) as ProjectLite[]));
  }, [currentWorkspaceId]);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        projects,
        currentWorkspace,
        currentProject,
        setCurrentWorkspaceId,
        setCurrentProjectId,
        refresh,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

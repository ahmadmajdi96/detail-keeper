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

  const setCurrentWorkspaceId = useCallback((id: string | null) => {
    setCurrentWorkspaceIdState(id);
    if (id) localStorage.setItem(LS_WS, id);
    else localStorage.removeItem(LS_WS);
    // reset project on workspace change
    setCurrentProjectIdState(null);
    localStorage.removeItem(LS_PROJ);
  }, []);

  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) localStorage.setItem(LS_PROJ, id);
    else localStorage.removeItem(LS_PROJ);
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id,name,status,owner_id")
        .order("created_at", { ascending: false });
      const list = (ws || []) as WorkspaceLite[];
      setWorkspaces(list);

      let activeWs = currentWorkspaceId;
      if (!activeWs || !list.find((w) => w.id === activeWs)) {
        activeWs = list[0]?.id || null;
        if (activeWs) {
          setCurrentWorkspaceIdState(activeWs);
          localStorage.setItem(LS_WS, activeWs);
        }
      }

      if (activeWs) {
        const { data: pr } = await supabase
          .from("projects")
          .select("id,workspace_id,name,status,source_type")
          .eq("workspace_id", activeWs)
          .order("created_at", { ascending: false });
        const plist = (pr || []) as ProjectLite[];
        setProjects(plist);
        if (currentProjectId && !plist.find((p) => p.id === currentProjectId)) {
          setCurrentProjectIdState(plist[0]?.id || null);
        }
      } else {
        setProjects([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentWorkspaceId, currentProjectId]);

  useEffect(() => {
    refresh();
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

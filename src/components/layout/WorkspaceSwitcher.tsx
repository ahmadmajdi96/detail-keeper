import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, FolderKanban, Plus, Settings, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

interface Props {
  onCreate?: () => void;
}

export function WorkspaceSwitcher({ onCreate }: Props) {
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 max-w-[220px] justify-between bg-card/50 backdrop-blur border-border/60"
        >
          <FolderKanban className="h-4 w-4 text-accent shrink-0" />
          <span className="truncate text-sm font-medium">
            {currentWorkspace?.name || "Select workspace"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {workspaces.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              No workspaces yet
            </div>
          )}
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => setCurrentWorkspaceId(w.id)}
              className="flex items-center gap-2"
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{w.name}</span>
              {currentWorkspace?.id === w.id && <Check className="h-4 w-4 text-accent" />}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        {currentWorkspace && (
          <DropdownMenuItem onClick={() => navigate(`/workspaces/${currentWorkspace.id}`)}>
            <FolderOpen className="mr-2 h-4 w-4" /> Open workspace
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate("/workspaces")}>
          <Settings className="mr-2 h-4 w-4" /> Manage workspaces
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreate ?? (() => navigate("/workspaces?new=1"))}>
          <Plus className="mr-2 h-4 w-4" /> New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectSwitcher() {
  const { projects, currentProject, currentWorkspace, setCurrentProjectId } = useWorkspace();
  const navigate = useNavigate();

  if (!currentWorkspace) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 max-w-[220px] justify-between bg-card/50 backdrop-blur border-border/60"
          )}
        >
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          <span className="truncate text-sm font-medium">
            {currentProject?.name || "All projects"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCurrentProjectId(null)}>
          <span className="h-2 w-2 rounded-full bg-muted-foreground mr-2" />
          <span className="flex-1">All projects</span>
          {!currentProject && <Check className="h-4 w-4 text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {projects.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              No projects yet
            </div>
          )}
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => setCurrentProjectId(p.id)}
              className="flex items-center gap-2"
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="flex-1 truncate">{p.name}</span>
              {currentProject?.id === p.id && <Check className="h-4 w-4 text-accent" />}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/projects")}>
          <FolderOpen className="mr-2 h-4 w-4" /> Manage projects
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/projects?new=1")}>
          <Plus className="mr-2 h-4 w-4" /> New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

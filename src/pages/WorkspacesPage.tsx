import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Users,
  HardDrive,
  FolderOpen,
  Settings,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Workspace } from "@/types";

// Mock data
const mockWorkspaces: Workspace[] = [
  {
    workspace_id: "1",
    name: "E-Commerce Platform",
    description: "Main e-commerce application testing workspace",
    owner_id: "1",
    created_date: "2024-01-15",
    status: "active",
    storage_quota: 10000,
    storage_used: 4500,
    projects_count: 8,
    members_count: 12,
  },
  {
    workspace_id: "2",
    name: "Mobile Banking App",
    description: "iOS and Android banking application QA",
    owner_id: "1",
    created_date: "2024-02-20",
    status: "active",
    storage_quota: 5000,
    storage_used: 2100,
    projects_count: 5,
    members_count: 8,
  },
  {
    workspace_id: "3",
    name: "Healthcare Portal",
    description: "Patient management system testing",
    owner_id: "2",
    created_date: "2024-03-10",
    status: "active",
    storage_quota: 8000,
    storage_used: 6800,
    projects_count: 3,
    members_count: 6,
  },
  {
    workspace_id: "4",
    name: "Legacy CRM Migration",
    description: "CRM system migration testing - archived",
    owner_id: "1",
    created_date: "2023-11-05",
    status: "archived",
    storage_quota: 3000,
    storage_used: 2900,
    projects_count: 2,
    members_count: 4,
  },
];

export default function WorkspacesPage() {
  const [workspaces] = useState<Workspace[]>(mockWorkspaces);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredWorkspaces = workspaces.filter(
    (ws) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStoragePercentage = (used?: number, total?: number) => {
    if (!used || !total) return 0;
    return Math.round((used / total) * 100);
  };

  const formatStorage = (mb?: number) => {
    if (!mb) return "0 MB";
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Workspaces"
        description="Manage your testing workspaces and projects"
        actions={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="ai-gradient text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to organize your testing projects
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input id="name" placeholder="Enter workspace name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose of this workspace"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="ai-gradient text-white">Create Workspace</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Workspaces Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredWorkspaces.map((workspace, index) => (
          <motion.div
            key={workspace.workspace_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="group hover:shadow-soft transition-all duration-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      workspace.status === "archived" ? "bg-muted" : "ai-gradient"
                    }`}>
                      <FolderKanban className={`h-5 w-5 ${
                        workspace.status === "archived" ? "text-muted-foreground" : "text-white"
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{workspace.name}</CardTitle>
                      <StatusBadge
                        variant={workspace.status === "active" ? "success" : "muted"}
                        size="sm"
                        className="mt-1"
                      >
                        {workspace.status}
                      </StatusBadge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {workspace.description}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span>{workspace.projects_count} projects</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{workspace.members_count} members</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <HardDrive className="h-3 w-3" />
                      Storage
                    </div>
                    <span className="text-muted-foreground">
                      {formatStorage(workspace.storage_used)} / {formatStorage(workspace.storage_quota)}
                    </span>
                  </div>
                  <Progress
                    value={getStoragePercentage(workspace.storage_used, workspace.storage_quota)}
                    className={`h-1.5 ${
                      getStoragePercentage(workspace.storage_used, workspace.storage_quota) > 85
                        ? "[&>div]:bg-destructive"
                        : getStoragePercentage(workspace.storage_used, workspace.storage_quota) > 70
                        ? "[&>div]:bg-warning"
                        : ""
                    }`}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {filteredWorkspaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No workspaces found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first workspace to get started"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          )}
        </div>
      )}
    </AppLayout>
  );
}

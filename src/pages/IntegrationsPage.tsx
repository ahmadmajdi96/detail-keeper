import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plug,
  Search,
  Check,
  X,
  ExternalLink,
  Zap,
  GitBranch,
  MessageSquare,
  Trello,
  Webhook,
  Cloud,
  Bot,
  Settings,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "cicd" | "chat" | "project" | "testing" | "api";
  connected: boolean;
  status?: "active" | "error" | "syncing";
  lastSync?: string;
}

const integrations: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect to GitHub for CI/CD pipeline integration and test automation triggers",
    icon: GitBranch,
    category: "cicd",
    connected: true,
    status: "active",
    lastSync: "2 minutes ago",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Integrate with GitLab CI/CD for automated test execution",
    icon: GitBranch,
    category: "cicd",
    connected: false,
  },
  {
    id: "jenkins",
    name: "Jenkins",
    description: "Connect Jenkins pipelines for continuous testing",
    icon: Zap,
    category: "cicd",
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications and test results to Slack channels",
    icon: MessageSquare,
    category: "chat",
    connected: true,
    status: "active",
    lastSync: "5 minutes ago",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Integrate with MS Teams for notifications and collaboration",
    icon: MessageSquare,
    category: "chat",
    connected: false,
  },
  {
    id: "jira",
    name: "Jira",
    description: "Sync defects and test cases with Jira issues",
    icon: Trello,
    category: "project",
    connected: true,
    status: "syncing",
    lastSync: "Syncing...",
  },
  {
    id: "azure_devops",
    name: "Azure DevOps",
    description: "Connect to Azure DevOps for work item integration",
    icon: Cloud,
    category: "project",
    connected: false,
  },
  {
    id: "selenium",
    name: "Selenium Grid",
    description: "Execute automated tests on Selenium Grid infrastructure",
    icon: Bot,
    category: "testing",
    connected: false,
  },
  {
    id: "browserstack",
    name: "BrowserStack",
    description: "Run tests on BrowserStack cloud devices",
    icon: Cloud,
    category: "testing",
    connected: false,
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Send custom webhooks for any event in the system",
    icon: Webhook,
    category: "api",
    connected: true,
    status: "active",
    lastSync: "1 hour ago",
  },
];

const categoryLabels: Record<string, string> = {
  cicd: "CI/CD",
  chat: "Communication",
  project: "Project Management",
  testing: "Testing Tools",
  api: "API & Webhooks",
};

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [integrationsList, setIntegrationsList] = useState(integrations);
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const filteredIntegrations = integrationsList.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const connectedCount = integrationsList.filter(i => i.connected).length;

  const handleConnect = async () => {
    if (!selectedIntegration) return;
    
    setIsConnecting(true);
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIntegrationsList(prev => 
      prev.map(i => 
        i.id === selectedIntegration.id 
          ? { ...i, connected: true, status: "active" as const, lastSync: "Just now" }
          : i
      )
    );
    
    setIsConnecting(false);
    setConfigureDialogOpen(false);
    setApiKey("");
    toast.success(`${selectedIntegration.name} connected successfully`);
  };

  const handleDisconnect = (integration: Integration) => {
    setIntegrationsList(prev => 
      prev.map(i => 
        i.id === integration.id 
          ? { ...i, connected: false, status: undefined, lastSync: undefined }
          : i
      )
    );
    toast.success(`${integration.name} disconnected`);
  };

  const handleSync = async (integration: Integration) => {
    setIntegrationsList(prev => 
      prev.map(i => 
        i.id === integration.id 
          ? { ...i, status: "syncing" as const, lastSync: "Syncing..." }
          : i
      )
    );

    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIntegrationsList(prev => 
      prev.map(i => 
        i.id === integration.id 
          ? { ...i, status: "active" as const, lastSync: "Just now" }
          : i
      )
    );
    toast.success(`${integration.name} synced successfully`);
  };

  const openConfigureDialog = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigureDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Integration Gateway"
          description="Connect external tools and services to enhance your testing workflow"
          actions={
            <Button className="ai-gradient text-white">
              <Plug className="mr-2 h-4 w-4" />
              Request Integration
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{integrationsList.length}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{connectedCount}</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {integrationsList.filter(i => i.status === "active").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <RefreshCw className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {integrationsList.filter(i => i.status === "syncing").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Syncing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="cicd">CI/CD</TabsTrigger>
            <TabsTrigger value="chat">Communication</TabsTrigger>
            <TabsTrigger value="project">Project Management</TabsTrigger>
            <TabsTrigger value="testing">Testing Tools</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((integration, index) => {
                const Icon = integration.icon;
                return (
                  <motion.div
                    key={integration.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-border/50 h-full hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{integration.name}</CardTitle>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {categoryLabels[integration.category]}
                              </Badge>
                            </div>
                          </div>
                          {integration.connected && (
                            <Badge 
                              variant="outline" 
                              className={
                                integration.status === "active" 
                                  ? "bg-success/10 text-success border-success/20"
                                  : integration.status === "syncing"
                                  ? "bg-warning/10 text-warning border-warning/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }
                            >
                              {integration.status === "syncing" && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              {integration.status}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          {integration.description}
                        </p>
                        {integration.lastSync && (
                          <p className="text-xs text-muted-foreground mb-4">
                            Last sync: {integration.lastSync}
                          </p>
                        )}
                        <div className="flex gap-2">
                          {integration.connected ? (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => handleSync(integration)}
                                disabled={integration.status === "syncing"}
                              >
                                <RefreshCw className={`mr-2 h-4 w-4 ${integration.status === "syncing" ? "animate-spin" : ""}`} />
                                Sync
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openConfigureDialog(integration)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDisconnect(integration)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button 
                              className="w-full ai-gradient text-white" 
                              size="sm"
                              onClick={() => openConfigureDialog(integration)}
                            >
                              <Plug className="mr-2 h-4 w-4" />
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {filteredIntegrations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Plug className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No integrations found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Configure Dialog */}
      <Dialog open={configureDialogOpen} onOpenChange={setConfigureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegration && (
                <>
                  <selectedIntegration.icon className="h-5 w-5" />
                  {selectedIntegration.connected ? "Configure" : "Connect"} {selectedIntegration.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedIntegration?.connected 
                ? "Update your integration settings"
                : "Enter your credentials to connect this integration"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL (Optional)</Label>
              <Input
                id="webhook-url"
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Auto-sync enabled</p>
                <p className="text-xs text-muted-foreground">Automatically sync data every hour</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigureDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="ai-gradient text-white" 
              onClick={handleConnect}
              disabled={isConnecting || !apiKey}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {selectedIntegration?.connected ? "Save" : "Connect"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  TestTube,
  Bug,
  Bot,
  FileText,
  Users,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const defaultSettings: NotificationSetting[] = [
  {
    id: "test_execution",
    title: "Test Execution Updates",
    description: "Notifications when test executions complete or fail",
    icon: TestTube,
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "defect_alerts",
    title: "Defect Alerts",
    description: "Alerts for new defects and status changes",
    icon: Bug,
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "ai_insights",
    title: "AI Insights",
    description: "AI-generated recommendations and pattern discoveries",
    icon: Bot,
    email: false,
    push: true,
    inApp: true,
  },
  {
    id: "document_processing",
    title: "Document Processing",
    description: "Updates when documents are processed and requirements extracted",
    icon: FileText,
    email: true,
    push: false,
    inApp: true,
  },
  {
    id: "team_updates",
    title: "Team Updates",
    description: "Notifications about team member activities and assignments",
    icon: Users,
    email: false,
    push: false,
    inApp: true,
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  const updateSetting = (id: string, channel: 'email' | 'push' | 'inApp', value: boolean) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.id === id 
          ? { ...setting, [channel]: value }
          : setting
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success("Notification preferences saved successfully");
  };

  const enableAll = () => {
    setSettings(prev => 
      prev.map(setting => ({
        ...setting,
        email: true,
        push: true,
        inApp: true,
      }))
    );
  };

  const disableAll = () => {
    setSettings(prev => 
      prev.map(setting => ({
        ...setting,
        email: false,
        push: false,
        inApp: false,
      }))
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Notification Preferences"
          description="Manage how and when you receive notifications"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={disableAll}>
                Disable All
              </Button>
              <Button variant="outline" onClick={enableAll}>
                Enable All
              </Button>
              <Button 
                className="ai-gradient text-white" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          }
        />

        {/* Channel Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.filter(s => s.email).length} of {settings.length} enabled
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Smartphone className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Push</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.filter(s => s.push).length} of {settings.length} enabled
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Bell className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">In-App</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.filter(s => s.inApp).length} of {settings.length} enabled
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notification Categories */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure which notifications you want to receive and through which channels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Header Row */}
            <div className="hidden md:grid grid-cols-[1fr,100px,100px,100px] gap-4 text-sm font-medium text-muted-foreground px-4">
              <span>Notification Type</span>
              <span className="text-center">Email</span>
              <span className="text-center">Push</span>
              <span className="text-center">In-App</span>
            </div>
            <Separator />
            
            {settings.map((setting, index) => {
              const Icon = setting.icon;
              return (
                <motion.div
                  key={setting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr,100px,100px,100px] gap-4 items-center p-4 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{setting.title}</p>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center md:justify-center gap-2">
                    <Label className="md:hidden text-xs text-muted-foreground">Email</Label>
                    <Switch
                      checked={setting.email}
                      onCheckedChange={(value) => updateSetting(setting.id, 'email', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center md:justify-center gap-2">
                    <Label className="md:hidden text-xs text-muted-foreground">Push</Label>
                    <Switch
                      checked={setting.push}
                      onCheckedChange={(value) => updateSetting(setting.id, 'push', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center md:justify-center gap-2">
                    <Label className="md:hidden text-xs text-muted-foreground">In-App</Label>
                    <Switch
                      checked={setting.inApp}
                      onCheckedChange={(value) => updateSetting(setting.id, 'inApp', value)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Quiet Hours
            </CardTitle>
            <CardDescription>
              Set times when you don't want to receive push notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Enable Quiet Hours</p>
                  <p className="text-sm text-muted-foreground">
                    Pause push notifications during specified times
                  </p>
                </div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

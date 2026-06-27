import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceSwitcher, ProjectSwitcher } from "./WorkspaceSwitcher";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  useRealtimeUpdates();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-[72px] md:pl-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-14 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container max-w-7xl h-full px-4 md:px-6 flex items-center gap-2">
            <WorkspaceSwitcher />
            <span className="text-muted-foreground text-sm">/</span>
            <ProjectSwitcher />
            <div className="flex-1" />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1">
          <div className="container max-w-7xl py-6 px-4 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceSwitcher, ProjectSwitcher } from "./WorkspaceSwitcher";
import { WorkflowNav } from "./WorkflowNav";
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
      <div className="pl-0 md:pl-[72px] min-h-screen flex flex-col transition-[padding] duration-200">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-full px-3 md:px-6 flex items-center gap-2">
            <div className="w-12 md:hidden" />
            <WorkspaceSwitcher />
            <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
            <div className="hidden sm:block"><ProjectSwitcher /></div>
            <div className="flex-1" />
            <WorkflowNav />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <div className="w-full max-w-[1600px] mx-auto py-6 px-3 md:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

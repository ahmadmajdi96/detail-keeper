import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Enable realtime updates across the app
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
      {/* Top notification bar */}
      <div className="fixed top-4 right-4 z-50">
        <NotificationBell />
      </div>
      <main className="pl-[72px] md:pl-64 min-h-screen">
        <div className="container max-w-7xl py-6 px-4 md:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database['public']['Enums']['user_role'];

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  fallbackPath = "/dashboard" 
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return null; // AppLayout handles loading state
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check permission
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = hasPermission(allowedRoles);
    if (!hasAccess) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}

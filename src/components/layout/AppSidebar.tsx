import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FolderOpen,
  FileText,
  ClipboardList,
  TestTube,
  Play,
  Bot,
  BarChart3,
  Bell,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Bug,
  Eye,
  Menu,
  X,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";

type UserRole = Database['public']['Enums']['user_role'];

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  badge?: string;
  isAI?: boolean;
}

// Navigation items with role requirements
const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Workspaces", href: "/workspaces", icon: FolderKanban, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Projects", href: "/projects", icon: FolderOpen, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Documents", href: "/documents", icon: FileText, isAI: true, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Test Plans", href: "/test-plans", icon: ClipboardList, isAI: true, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Test Cases", href: "/test-cases", icon: TestTube, isAI: true, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Executions", href: "/executions", icon: Play, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Defects", href: "/defects", icon: Bug, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "AI Automation", href: "/automation", icon: Bot, isAI: true, roles: ["qa_engineer", "qa_manager", "admin"] },
  { title: "Reports", href: "/reporting", icon: BarChart3, isAI: true, roles: ["qa_engineer", "qa_manager", "admin"] },
];

// Viewer can only see dashboard and these items
const viewerNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "View Reports", href: "/reporting", icon: Eye },
];

const adminNavItems: NavItem[] = [
  { title: "Users", href: "/users", icon: Users, roles: ["admin", "qa_manager"] },
  { title: "Integrations", href: "/integrations", icon: Plug, roles: ["admin"] },
];

const bottomNavItems: NavItem[] = [
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("qx_sidebar_collapsed");
    if (stored !== null) return stored === "1";
    return true; // default collapsed
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("qx_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const isMobile = useIsMobile();
  const effectiveCollapsed = isMobile ? false : collapsed;
  const sidebarWidth = isMobile ? 256 : (collapsed ? 72 : 256);

  // Determine which nav items to show based on user role
  const getNavItems = () => {
    if (!user) return [];
    if (user.role === "viewer") {
      return viewerNavItems;
    }
    return mainNavItems;
  };

  const renderNavItem = (item: NavItem, index: number) => {
    // Check role-based access
    if (item.roles && item.roles.length > 0) {
      const hasAccess = hasPermission(item.roles);
      if (!hasAccess) return null;
    }

    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
    const Icon = item.icon;

    const content = (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <div className="relative">
          <Icon className={cn("h-5 w-5 shrink-0", item.isAI && !isActive && "text-accent")} />
          {item.isAI && (
            <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 text-accent animate-pulse" />
          )}
        </div>
        <AnimatePresence mode="wait">
          {!effectiveCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="whitespace-nowrap"
            >
              {item.title}
            </motion.span>
          )}
        </AnimatePresence>
        {item.badge && !effectiveCollapsed && (
          <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.title}
            {item.isAI && <Sparkles className="h-3 w-3 text-accent" />}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{content}</div>;
  };

  // Get role display label
  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      admin: "Administrator",
      qa_manager: "QA Manager",
      qa_engineer: "QA Engineer",
      viewer: "Viewer",
    };
    return labels[role] || role;
  };

  // Get role badge color
  const getRoleBadgeClass = (role: UserRole) => {
    const classes: Record<UserRole, string> = {
      admin: "bg-red-500/20 text-red-400",
      qa_manager: "bg-purple-500/20 text-purple-400",
      qa_engineer: "bg-cyan-500/20 text-cyan-400",
      viewer: "bg-gray-500/20 text-gray-400",
    };
    return classes[role] || "";
  };

  const navItems = getNavItems();

  const sidebarBody = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg ai-gradient">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <AnimatePresence mode="wait">
            {!effectiveCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <span className="text-lg font-bold text-sidebar-foreground">Qualixa</span>
                <span className="block text-[10px] text-sidebar-muted -mt-1">Quality Intelligence</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item, i) => renderNavItem(item, i))}
        </nav>

        {adminNavItems.some(item => !item.roles || hasPermission(item.roles)) && (
          <>
            <div className="my-4 h-px bg-sidebar-border" />
            <nav className="space-y-1">
              {adminNavItems.map((item, i) => renderNavItem(item, i))}
            </nav>
          </>
        )}
      </ScrollArea>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3">
        <nav className="space-y-1 mb-3">
          {bottomNavItems.map((item, i) => renderNavItem(item, i))}
        </nav>

        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2",
          effectiveCollapsed ? "justify-center" : ""
        )}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground font-medium text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <AnimatePresence mode="wait">
            {!effectiveCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
                <span className={cn(
                  "inline-block px-2 py-0.5 rounded text-[10px] font-medium mt-0.5",
                  user?.role && getRoleBadgeClass(user.role)
                )}>
                  {user?.role && getRoleLabel(user.role)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {!effectiveCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button (rendered in fixed position; AppLayout header also has one) */}
      {isMobile && !mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed top-2.5 left-2 z-50 h-9 w-9 md:hidden bg-background/80 backdrop-blur border border-border/40"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{
          width: sidebarWidth,
          x: isMobile && !mobileOpen ? -sidebarWidth : 0,
        }}
        transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar"
      >
        {sidebarBody}
      </motion.aside>
    </>
  );
}

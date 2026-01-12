import { useState } from "react";
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
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  badge?: string;
  isAI?: boolean;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Workspaces", href: "/workspaces", icon: FolderKanban },
  { title: "Documents", href: "/documents", icon: FileText, isAI: true },
  { title: "Test Plans", href: "/test-plans", icon: ClipboardList, isAI: true },
  { title: "Test Cases", href: "/test-cases", icon: TestTube, isAI: true },
  { title: "Executions", href: "/executions", icon: Play },
  { title: "Defects", href: "/defects", icon: Bug },
  { title: "AI Automation", href: "/automation", icon: Bot, isAI: true },
  { title: "Reports", href: "/reporting", icon: BarChart3, isAI: true },
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
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const renderNavItem = (item: NavItem, index: number) => {
    if (item.roles && !hasPermission(item.roles as any)) {
      return null;
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
          {!collapsed && (
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
        {item.badge && !collapsed && (
          <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg ai-gradient">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {mainNavItems.map(renderNavItem)}
        </nav>

        {adminNavItems.some(item => !item.roles || hasPermission(item.roles as any)) && (
          <>
            <div className="my-4 h-px bg-sidebar-border" />
            <nav className="space-y-1">
              {adminNavItems.map(renderNavItem)}
            </nav>
          </>
        )}
      </ScrollArea>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3">
        <nav className="space-y-1 mb-3">
          {bottomNavItems.map(renderNavItem)}
        </nav>
        
        {/* User section */}
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2",
          collapsed ? "justify-center" : ""
        )}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground font-medium text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
                <p className="text-xs text-sidebar-muted capitalize">{user?.role?.replace("_", " ")}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
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
    </motion.aside>
  );
}

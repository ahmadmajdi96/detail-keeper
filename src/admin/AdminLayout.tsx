import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import "./theme.css";

const NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/repositories", label: "Repositories" },
  { to: "/admin/requirement-versions", label: "Requirement Versions" },
  { to: "/admin/defects", label: "Defects" },
  { to: "/admin/approvals", label: "Approvals & Waivers" },
  { to: "/admin/ai-jobs", label: "AI Jobs" },
];

export function AdminLayout() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="admin-shell p-8">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") {
    return (
      <div className="admin-shell flex items-center justify-center p-12">
        <div className="admin-surface p-8 rounded max-w-md text-center">
          <h1 className="text-xl mb-2 admin-accent">403 — Admin only</h1>
          <p className="text-sm opacity-70">This console is restricted to admin users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-surface flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="admin-accent font-bold text-lg">QUALIXA</span>
          <span className="badge admin-accent">ADMIN</span>
        </div>
        <div className="text-xs opacity-60">{user?.email}</div>
      </header>
      <div className="flex">
        <aside className="admin-surface w-56 min-h-[calc(100vh-49px)] p-3 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive ? "admin-accent-bg" : "hover:bg-white/5"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

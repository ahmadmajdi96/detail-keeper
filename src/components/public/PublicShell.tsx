import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ReactNode } from "react";

export function PublicShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[hsl(187,92%,50%)] opacity-[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.06] blur-[120px]" />
      </div>
      <nav className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[hsl(222,47%,6%)]/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-semibold">Qualixa</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link to="/pricing" className="hover:text-white">Pricing</Link>
            <Link to="/docs" className="hover:text-white">Docs</Link>
            <Link to="/security" className="hover:text-white">Security</Link>
            <Link to="/login" className="hover:text-white">Sign in</Link>
            <Link to="/register" className="px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white text-sm">Get started</Link>
          </div>
        </div>
      </nav>
      <main className="relative max-w-4xl mx-auto px-6 py-16">
        {title && <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">{title}</h1>}
        {children}
      </main>
      <footer className="relative border-t border-white/5 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div>© {new Date().getFullYear()} Qualixa. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/security" className="hover:text-white">Security</Link>
            <Link to="/docs" className="hover:text-white">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

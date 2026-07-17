import { PublicShell } from "@/components/public/PublicShell";
import { Link } from "react-router-dom";
import { BookOpen, Rocket, Boxes, Zap, ShieldCheck, GitBranch } from "lucide-react";

const SECTIONS = [
  {
    icon: Rocket,
    title: "Getting started",
    items: [
      { name: "Quickstart: your first project", href: "#" },
      { name: "Signing up and creating an organization", href: "#" },
      { name: "Inviting your team", href: "#" },
    ],
  },
  {
    icon: Boxes,
    title: "Core concepts",
    items: [
      { name: "Organizations, workspaces, and projects", href: "#" },
      { name: "Documents → Test plans → Test cases", href: "#" },
      { name: "Releases, cycles, and executions", href: "#" },
    ],
  },
  {
    icon: Zap,
    title: "AI features",
    items: [
      { name: "AI-generated test plans", href: "#" },
      { name: "Requirements extraction", href: "#" },
      { name: "The AI release judge", href: "#" },
    ],
  },
  {
    icon: GitBranch,
    title: "Integrations",
    items: [
      { name: "GitHub", href: "#" },
      { name: "Jira", href: "#" },
      { name: "Slack, WhatsApp, Telegram", href: "#" },
      { name: "CI ingestion (JUnit, Playwright, Cypress)", href: "#" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Administration",
    items: [
      { name: "Role-based access control", href: "#" },
      { name: "Billing and usage", href: "#" },
      { name: "Audit log", href: "#" },
    ],
  },
  {
    icon: BookOpen,
    title: "API & developers",
    items: [
      { name: "REST API reference", href: "#" },
      { name: "Webhooks", href: "#" },
      { name: "Self-hosted runners", href: "#" },
    ],
  },
];

export default function DocsPage() {
  return (
    <PublicShell title="Documentation">
      <p className="text-white/60 text-lg mb-12 -mt-4">
        Everything you need to run Qualixa in your team — from a first project to advanced automation.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl p-6 border border-white/10 bg-[hsl(222,47%,8%)] hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[hsl(187,92%,50%)/0.1] border border-[hsl(187,92%,50%)/0.3]">
                <section.icon className="h-4 w-4 text-[hsl(187,92%,50%)]" />
              </div>
              <h2 className="text-lg font-semibold">{section.title}</h2>
            </div>
            <ul className="space-y-2">
              {section.items.map((i) => (
                <li key={i.name}>
                  <a href={i.href} className="text-sm text-white/70 hover:text-white transition-colors">
                    {i.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-2xl border border-white/10 bg-[hsl(222,47%,8%)] text-center">
        <p className="text-sm text-white/60 mb-3">
          More detailed guides are on the way. Ready to try it yourself?
        </p>
        <Link
          to="/register"
          className="inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white text-sm font-medium"
        >
          Get started free
        </Link>
      </div>
    </PublicShell>
  );
}

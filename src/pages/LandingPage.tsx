import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TestTube,
  Bot,
  FileText,
  Bug,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Play,
  Sparkles,
  GitBranch,
  Bell,
  ChevronRight,
  Star,
  Shield,
  Lock,
  Rocket,
  Zap,
  Globe,
  Check,
  X,
  Compass,
  Target,
  Layers,
  Workflow,
  Database,
  Eye,
  Wand2,
  Building2,
  Users,
  Code2,
  LineChart,
  Briefcase,
  ServerCog,
  Microscope,
  Clock,
} from "lucide-react";
import { Logo } from "@/components/Logo";

// Company logos for marquee
const companyLogos = [
  "TechCorp", "DataFlow", "CloudScale", "DevOps Pro", "QualityFirst",
  "TestMaster", "AgileWorks", "CodeStream", "InnovateTech", "ScaleUp",
];

// ===== Pricing Card =====
const PricingCard = ({
  plan, price, yearlyPrice, isYearly, features, isPopular, ctaText, onCta,
}: {
  plan: string; price: number; yearlyPrice: number; isYearly: boolean;
  features: { text: string; included: boolean }[];
  isPopular?: boolean; ctaText: string; onCta: () => void;
}) => {
  const displayPrice = isYearly ? yearlyPrice : price;
  return (
    <div className={`relative group ${isPopular ? "lg:scale-105 z-10" : ""}`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-sm font-medium">
          Most Popular
        </div>
      )}
      <div className={`relative rounded-2xl p-8 h-full transition-all duration-300 ${
        isPopular
          ? "bg-gradient-to-b from-[hsl(222,47%,10%)] to-[hsl(222,47%,6%)] border-2 border-[hsl(187,92%,50%)/0.5] shadow-[0_0_40px_-10px_hsl(187,92%,50%/0.3)]"
          : "bg-[hsl(222,47%,8%)] border border-white/10 hover:border-white/20"
      }`}>
        <h3 className="text-2xl font-bold mb-2">{plan}</h3>
        <div className="mb-6">
          <span className="text-5xl font-bold">${displayPrice}</span>
          <span className="text-white/50">/{isYearly ? "year" : "month"}</span>
          {isYearly && price > 0 && (
            <p className="text-sm text-[hsl(187,92%,50%)] mt-1">Save ${(price * 12) - yearlyPrice}/year</p>
          )}
        </div>
        <ul className="space-y-3 mb-8">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3">
              {feature.included
                ? <Check className="h-5 w-5 text-[hsl(187,92%,50%)] shrink-0" />
                : <X className="h-5 w-5 text-white/20 shrink-0" />}
              <span className={feature.included ? "text-white/80" : "text-white/30"}>{feature.text}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onCta}
          className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
            isPopular
              ? "bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white hover:shadow-lg hover:shadow-[hsl(187,92%,50%)/0.3] hover:-translate-y-1"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {ctaText}
        </button>
      </div>
    </div>
  );
};

// ===== Reveal wrapper =====
const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

// ===== Data =====
const osLayers = [
  {
    eyebrow: "The Interaction Layer",
    title: "Qualixa Spaces",
    headline: "Unify test plans, executions, defects, and docs into one connected workspace.",
    body: "Spaces gives every team a shared place to plan, execute, and ship quality work — so QA stops switching tools and starts shipping faster.",
    bullets: ["One workspace for daily QA operations", "Built to scale across squads and releases"],
    icon: Layers,
  },
  {
    eyebrow: "From Consumption to Creation",
    title: "Qualixa Studio",
    headline: "Author rich test cases without juggling spreadsheets and wikis.",
    body: "Studio composes steps, fixtures, data, and assertions in one seamless editor so engineers spend their time testing — not formatting.",
    bullets: ["Richer cases with less effort", "No-code authoring for every tester"],
    icon: Wand2,
  },
  {
    eyebrow: "The Big Idea",
    title: "Qualixa Quests",
    headline: "Turn regressions into goal-driven runs your team actually finishes.",
    body: "Quests transforms coverage targets into focused, AI-prioritized runs that keep velocity high and confidence higher.",
    bullets: ["AI-prioritized paths aligned to risk and coverage", "Streaks, ownership, and progression that keep teams shipping"],
    icon: Target,
  },
  {
    eyebrow: "Procurement, Simplified",
    title: "The Qualixa Integrations Hub",
    headline: "One secure hub for every tool your QA org depends on.",
    body: "Discover, approve, and govern integrations from GitHub to Jira to Slack — so engineers move fast while you stay in full control.",
    bullets: ["Centralized approvals, billing, and vendor governance", "Native connectors across CI/CD, ticketing, and chat"],
    icon: Workflow,
  },
  {
    eyebrow: "The Cognition Engine",
    title: "Qualixa DNA",
    headline: "Go beyond pass/fail. Understand how your product actually behaves.",
    body: "DNA surfaces each release's risk patterns, flake signatures, and quality fingerprints — so intervention becomes precise and timely.",
    bullets: ["Living risk profiles built from runs, defects, and code signals", "Actionable insights that route work to the right owner"],
    icon: Database,
  },
  {
    eyebrow: "Integrated Utilities",
    title: "Invisible Tools for Zero-Touch QA.",
    headline: "",
    body: "",
    bullets: [],
    icon: ServerCog,
    utilities: [
      { icon: Bot, title: "Auto-Triage", desc: "Classify and route incoming defects in under a second. Flags regression risk before it ships." },
      { icon: Bell, title: "Quality Signal", desc: "Realtime alerts deeply integrated with the OS — execution context travels with every notification." },
      { icon: GitBranch, title: "Pipeline Sync", desc: "A secure protocol connecting runs, commits, and the 'Aware' AI agent in a unified stream." },
    ],
  },
];

const personas = [
  { key: "engineers", label: "QA Engineers", icon: Microscope,
    headline: "From firefighter, to architect.",
    body: "Stop chasing flaky runs; start designing coverage. Qualixa gives engineers a comprehensive view of every assertion and trend.",
    agents: [
      { emoji: "🔮", name: "Coverage Planner", desc: "Turns requirements into actionable test paths" },
      { emoji: "♟️", name: "Strategy Agent", desc: "Analyzes runs to recommend the next high-value test" },
      { emoji: "🕵️", name: "Insight Detective", desc: "Surfaces hidden flake and regression patterns" },
      { emoji: "🔭", name: "Forecast Engine", desc: "Predicts release risk before the freeze" },
    ],
  },
  { key: "managers", label: "QA Managers", icon: Briefcase,
    headline: "Lead the release, not the spreadsheet.",
    body: "Replace status meetings with live signal. Qualixa rolls up squads, sprints, and suites into a single decision surface.",
    agents: [
      { emoji: "📊", name: "Release Lens", desc: "Live readiness across every squad" },
      { emoji: "🧭", name: "Risk Compass", desc: "Where to spend the next testing hour" },
      { emoji: "🪄", name: "Auto-Reporter", desc: "Stakeholder-ready summaries on demand" },
      { emoji: "⏱️", name: "Velocity Tracker", desc: "Cycle time, MTTR, and escape rate" },
    ],
  },
  { key: "developers", label: "Developers", icon: Code2,
    headline: "Catch the bug before the PR closes.",
    body: "Qualixa meets developers in their IDE and CI — generating tests from diffs and flagging regressions inline.",
    agents: [
      { emoji: "🧪", name: "Diff Tester", desc: "Generates cases from each pull request" },
      { emoji: "🔁", name: "Replay Agent", desc: "Reproduces failures with one click" },
      { emoji: "🧠", name: "Context Engine", desc: "Links failing tests to the exact change" },
      { emoji: "🚦", name: "Gate Agent", desc: "Blocks risky merges with evidence" },
    ],
  },
  { key: "product", label: "Product", icon: Compass,
    headline: "Know what's truly ready to ship.",
    body: "Connect requirements to evidence. Every feature has a living quality story — from spec to staging to production.",
    agents: [
      { emoji: "🗺️", name: "Spec Mapper", desc: "Traces every requirement to its tests" },
      { emoji: "✅", name: "Readiness Agent", desc: "Confidence score per feature" },
      { emoji: "📣", name: "Launch Sentinel", desc: "Watches the post-release metrics" },
      { emoji: "🎯", name: "Outcome Tracker", desc: "Quality KPIs tied to OKRs" },
    ],
  },
  { key: "leadership", label: "Leadership", icon: LineChart,
    headline: "Quality as a board-level metric.",
    body: "Move from anecdotes to evidence. Qualixa quantifies quality investment and the risk it removes.",
    agents: [
      { emoji: "📈", name: "Trend Engine", desc: "Quarterly quality trajectory" },
      { emoji: "💼", name: "Investment Lens", desc: "ROI on QA spend" },
      { emoji: "🛡️", name: "Risk Officer", desc: "Top exposure surfaces ranked" },
      { emoji: "🌐", name: "Org Heatmap", desc: "Quality health across every team" },
    ],
  },
];

const bento = [
  { icon: Wand2, title: "AI Workbench", desc: "Generate 10 living test docs, derive test cases, and synthesize Playwright code per case — all from a Monaco multi-tab editor." },
  { icon: Play, title: "One-Click Run Suite", desc: "Dispatch generated specs to registered runners with inline browser, headless, and retry config. Watch progress stream in real time." },
  { icon: Database, title: "Replayable Artifacts", desc: "Every suite run snapshots its docs JSON and per-case .spec.ts files so you can reopen, inspect, and rerun any historical run." },
  { icon: Eye, title: "Cognitive Profiles", desc: "A living quality profile per feature — requirements, variables, benchmarks, and hidden risks in one view." },
];

const days = [
  { day: "Day 1", title: "Ingest, then generate.",
    body: "Point Qualixa at your docs or repo. The AI Workbench produces 10 test plan documents, requirements, variables, benchmarks, and per-case Playwright code in one flow.",
    magic: "What used to take a sprint of authoring lands in minutes." },
  { day: "Day 2", title: "Run the suite, watch it live.",
    body: "Hit Run Suite to dispatch every generated spec to your registered runner with the browser, headless, and retry settings you choose. Per-case status streams back in real time.",
    magic: "Executions stop being a black box — every case reports as it finishes." },
  { day: "Day 3 and beyond", title: "Reopen, replay, ship with confidence.",
    body: "Each suite run archives its docs and .spec.ts artifacts. Reopen any past run in the Workbench, browse the files, and rerun with the exact same configuration.",
    magic: "Quality history becomes an asset you can audit, diff, and re-execute on demand." },
];

const faqs = [
  { q: "What is the AI Workbench?", a: "A Monaco multi-tab editor inside every Test Plan. It runs the AI through generate-docs → generate-cases → generate-code, so you end up with up to 10 living docs and a Playwright .spec.ts per test case — all editable in place." },
  { q: "How does one-click Run Suite work?", a: "Run Suite dispatches every generated spec to a registered runner with your chosen browser, headless mode, and retry count. A suite_run row tracks rollup status while per-spec progress streams back into the Workbench in real time." },
  { q: "Can I reopen and rerun a past suite?", a: "Yes. Every spec_run archives a snapshot of the docs JSON and per-case Playwright files. The Artifact Viewer lets you browse, download, and rerun any historical suite with the exact original configuration." },
  { q: "What is Qualixa and who is it for?", a: "Qualixa is an AI-powered quality intelligence platform for engineering organizations that want one connected system for test management, execution, defects, and analytics." },
  { q: "Can Qualixa replace our existing test management tool?", a: "Yes. Qualixa consolidates planning, authoring, execution, defects, and reporting. Most teams migrate existing assets via our importers in days, not weeks." },
  { q: "Does Qualixa fit small teams as well as enterprises?", a: "Yes. The platform scales from a single squad to multi-org deployments with workspaces, projects, RBAC, and SSO." },
  { q: "Will Qualixa increase or reduce QA workload?", a: "It reduces it. AI handles triage, generation, and reporting so your team spends time on the work only humans can do." },
  { q: "How fast can we get started?", a: "Most teams are running their first AI-assisted suite within a day. Ingest documentation or a repository and Qualixa generates an initial coverage plan automatically." },
  { q: "How does Qualixa improve the release experience?", a: "By giving every release a live quality signal — readiness, risk, and evidence — that product, engineering, and leadership all trust." },
  { q: "Is Qualixa secure for sensitive product data?", a: "Yes. Enterprise-grade isolation, encryption at rest and in transit, RBAC, audit logs, and strict third-party AI controls." },
  { q: "Can Qualixa adapt to our existing workflow?", a: "Yes. Custom fields, workflows, and integrations let Qualixa wrap around your process — not the other way around." },
  { q: "Does Qualixa create vendor lock-in?", a: "No. Your data is yours. Export plans, cases, runs, and reports at any time in open formats." },
  { q: "Can we evaluate Qualixa before a full rollout?", a: "Yes. Pilot programs are available with priority support, custom onboarding, and data migration assistance." },
];

const stats = [
  { value: "99.9%", label: "Uptime Guarantee" },
  { value: "50%", label: "Faster Testing" },
  { value: "10x", label: "AI Productivity" },
  { value: "24/7", label: "Expert Support" },
];

const pricingPlans = [
  { plan: "Free", price: 0, yearlyPrice: 0, ctaText: "Get Started", features: [
    { text: "Up to 5 users", included: true },
    { text: "100 test cases", included: true },
    { text: "Basic reporting", included: true },
    { text: "Email support", included: true },
    { text: "AI test generation", included: false },
    { text: "Custom integrations", included: false },
    { text: "Advanced analytics", included: false },
    { text: "Priority support", included: false },
  ]},
  { plan: "Pro", price: 49, yearlyPrice: 470, ctaText: "Start Free Trial", isPopular: true, features: [
    { text: "Up to 25 users", included: true },
    { text: "Unlimited test cases", included: true },
    { text: "Advanced reporting", included: true },
    { text: "Priority email support", included: true },
    { text: "AI test generation", included: true },
    { text: "GitHub & Jira integration", included: true },
    { text: "Advanced analytics", included: true },
    { text: "Priority support", included: false },
  ]},
  { plan: "Enterprise", price: 199, yearlyPrice: 1990, ctaText: "Contact Sales", features: [
    { text: "Unlimited users", included: true },
    { text: "Unlimited test cases", included: true },
    { text: "Custom reporting", included: true },
    { text: "24/7 phone support", included: true },
    { text: "AI test generation", included: true },
    { text: "All integrations", included: true },
    { text: "Advanced analytics", included: true },
    { text: "Dedicated success manager", included: true },
  ]},
];

// ===== Hero integrations constellation (decorative) =====
const HeroVisual = () => {
  const tiles = [
    { icon: TestTube, color: "from-cyan-400 to-blue-500", x: 20, y: 10 },
    { icon: Bot, color: "from-purple-400 to-pink-500", x: 70, y: 8 },
    { icon: FileText, color: "from-blue-400 to-indigo-500", x: 8, y: 45 },
    { icon: Bug, color: "from-red-400 to-orange-500", x: 82, y: 38 },
    { icon: BarChart3, color: "from-yellow-400 to-orange-500", x: 18, y: 78 },
    { icon: GitBranch, color: "from-teal-400 to-cyan-500", x: 76, y: 78 },
    { icon: Shield, color: "from-emerald-400 to-green-500", x: 45, y: 5 },
    { icon: Zap, color: "from-fuchsia-400 to-purple-500", x: 45, y: 88 },
  ];
  return (
    <div className="relative w-full aspect-square max-w-[560px] mx-auto">
      {/* center hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] blur-3xl opacity-50 scale-150" />
        <div className="relative h-32 w-32 rounded-3xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center shadow-2xl">
          <TestTube className="h-14 w-14 text-white" />
        </div>
      </div>

      {/* radial lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {tiles.map((t, i) => (
          <line key={i} x1="50" y1="50" x2={t.x + 6} y2={t.y + 6}
            stroke="url(#g)" strokeWidth="0.2" strokeDasharray="0.6 0.6" opacity="0.5" />
        ))}
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(187,92%,50%)" />
            <stop offset="1" stopColor="hsl(262,83%,58%)" />
          </linearGradient>
        </defs>
      </svg>

      {/* tiles */}
      {tiles.map((t, i) => (
        <div key={i}
          className="absolute h-14 w-14 md:h-16 md:w-16 rounded-2xl border border-white/10 bg-[hsl(222,47%,8%)] flex items-center justify-center shadow-xl will-change-transform"
          style={{
            left: `${t.x}%`, top: `${t.y}%`,
            animation: `float 6s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          <div className={`h-full w-full rounded-2xl bg-gradient-to-br ${t.color} opacity-20 absolute inset-0`} />
          <t.icon className="relative h-6 w-6 md:h-7 md:w-7 text-white" />
        </div>
      ))}
    </div>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [isYearly, setIsYearly] = useState(false);

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.7], [1, 0.3]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-white overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(187,92%,50%)] opacity-[0.08] blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.08] blur-[120px] animate-pulse-slow animation-delay-2000" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(187 92% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(187 92% 50%) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* ===== Navigation ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 animate-fade-in-down">
        <div className="mx-4 mt-4">
          <div className="container max-w-7xl mx-auto px-6 py-4 rounded-2xl bg-[hsl(222,47%,6%)/0.7] backdrop-blur-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 hover:scale-[1.02] transition-transform duration-200">
                <Logo size={48} />
                <span className="text-xl font-bold tracking-tight">Qualixa</span>
              </div>

              <div className="hidden md:flex items-center gap-8">
                {[
                  { label: "Product", href: "#product" },
                  { label: "Workbench", href: "#workbench" },
                  { label: "DNA", href: "#dna" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Resources", href: "#faq" },
                ].map((item) => (
                  <a key={item.label} href={item.href}
                    className="relative text-sm text-white/60 hover:text-white transition-colors py-2 group">
                    {item.label}
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
                <button
                  onClick={() => navigate("/register")}
                  className="relative px-6 py-2.5 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-medium text-sm overflow-hidden group hover:shadow-lg hover:shadow-[hsl(187,92%,50%)/0.3] transition-shadow duration-300"
                >
                  <span className="relative z-10">Get Started</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== Hero (split: copy + visual) ===== */}
      <section ref={heroRef} className="relative pt-36 md:pt-40 pb-20">
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="container max-w-7xl mx-auto px-6 relative z-10"
        >
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
            <div>
              <a href="#workbench" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(187,92%,50%)/0.4] bg-[hsl(187,92%,50%)/0.05] backdrop-blur-xl mb-8 animate-fade-in-up group">
                <Sparkles className="h-4 w-4 text-[hsl(187,92%,50%)]" />
                <span className="text-sm bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent font-medium">
                  New: AI Workbench with one-click Playwright runs
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[hsl(187,92%,50%)] group-hover:translate-x-1 transition-transform" />
              </a>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight animate-fade-in-up animation-delay-200">
                The world's first{" "}
                <span>AI Quality Operating System</span>{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(220,90%,60%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  for engineering teams.
                </span>
              </h1>

              <ul className="mt-10 space-y-4 animate-fade-in-up animation-delay-400">
                {[
                  "Generate 10 test plan docs, test cases, and Playwright code from one AI Workbench.",
                  "Run entire suites on registered runners with inline browser, headless, and retry config.",
                  "Stream per-case progress live and replay any past suite from its saved artifacts.",
                  "Unify requirements, variables, benchmarks, and executions in a single Test Plan surface.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-white/70">
                    <span className="mt-1 h-5 w-5 rounded-full bg-[hsl(187,92%,50%)/0.15] border border-[hsl(187,92%,50%)/0.4] flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-[hsl(187,92%,50%)]" />
                    </span>
                    <span className="text-base md:text-lg">{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-center gap-6 animate-fade-in-up animation-delay-600">
                <button
                  onClick={() => navigate("/register")}
                  className="group relative h-14 px-8 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold text-base overflow-hidden hover:shadow-xl hover:shadow-[hsl(187,92%,50%)/0.3] transition-all duration-300 hover:-translate-y-0.5"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Get a Demo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                <div className="text-xs">
                  <div className="uppercase tracking-widest text-white/40">Talk to our quality experts</div>
                  <div className="text-white/60 mt-1">No credit card required</div>
                </div>
              </div>

              <div className="mt-10 flex items-center gap-8 text-white/40 text-xs uppercase tracking-widest animate-fade-in animation-delay-1000">
                <span>Trusted by 500+ teams</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span>50,000+ runs daily</span>
              </div>
            </div>

            <div className="animate-fade-in-up animation-delay-400">
              <HeroVisual />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== Trust logos marquee ===== */}
      <section className="py-12 border-y border-white/5 overflow-hidden">
        <div className="container max-w-7xl mx-auto px-6 mb-8">
          <p className="text-center text-white/40 text-xs uppercase tracking-[0.25em]">Trusted by the best</p>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[hsl(222,47%,4%)] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[hsl(222,47%,4%)] to-transparent z-10" />
          <div className="flex animate-marquee">
            {[...companyLogos, ...companyLogos].map((logo, i) => (
              <div key={i} className="flex-shrink-0 mx-10 flex items-center justify-center">
                <span className="text-2xl font-semibold tracking-tight text-white/30 hover:text-white/60 transition-colors">
                  {logo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Problem / Solution ===== */}
      <section className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12">
          <Reveal>
            <div className="rounded-3xl p-10 border border-white/5 bg-[hsl(222,47%,6%)] h-full">
              <div className="text-xs uppercase tracking-widest text-white/40 mb-4">The status quo</div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">QA is broken.</h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Disconnected tools. Flaky pipelines. Reports nobody reads. Engineering teams are forced to glue together a dozen apps just to know if a release is safe.
              </p>
              <div className="grid grid-cols-3 gap-3 opacity-70">
                {[Bug, FileText, GitBranch, BarChart3, Bell, TestTube].map((Icon, i) => (
                  <div key={i} className="aspect-square rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white/30" />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-3xl p-10 border border-[hsl(187,92%,50%)/0.3] bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(222,47%,5%)] h-full relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[hsl(187,92%,50%)/0.15] blur-3xl" />
              <div className="relative">
                <div className="text-xs uppercase tracking-widest text-[hsl(187,92%,50%)] mb-4">The Qualixa way</div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Qualixa fixes that.</h2>
                <p className="text-white/60 text-lg leading-relaxed mb-8">
                  Qualixa consolidates planning, authoring, execution, defects, and analytics into one environment — where AI agents do the heavy lifting and your team stays in control.
                </p>
                <button onClick={() => navigate("/register")}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm">
                  See Qualixa in action <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== OS Architecture (6 layers, alternating) ===== */}
      <section id="product" className="py-24 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Qualixa OS Architecture</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                The Operating System{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  for Modern QA
                </span>
              </h2>
              <p className="text-white/50 text-lg">
                Six powerful layers working in harmony to replace fragmented testing tools with one unified environment for planning, execution, and quality intelligence.
              </p>
            </div>
          </Reveal>

          <div className="space-y-32">
            {osLayers.map((layer, idx) => {
              const reverse = idx % 2 === 1;
              const isUtility = !!layer.utilities;
              return (
                <Reveal key={layer.title} delay={0.05}>
                  <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? "lg:[direction:rtl]" : ""}`}>
                    <div className="[direction:ltr]">
                      <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">{layer.eyebrow}</div>
                      <h3 className="text-3xl md:text-5xl font-bold mb-4">{layer.title}</h3>
                      {layer.headline && <p className="text-xl md:text-2xl text-white/80 mb-4">{layer.headline}</p>}
                      {layer.body && <p className="text-white/50 text-base leading-relaxed mb-6">{layer.body}</p>}
                      {isUtility ? (
                        <div className="space-y-4 mt-6">
                          {layer.utilities!.map((u) => (
                            <div key={u.title} className="flex gap-4 p-5 rounded-2xl bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] transition-colors">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center shrink-0">
                                <u.icon className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="font-semibold mb-1">{u.title}</div>
                                <p className="text-sm text-white/50">{u.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {layer.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-3 text-white/70">
                              <Check className="h-5 w-5 text-[hsl(187,92%,50%)] mt-0.5 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="[direction:ltr]">
                      <div className="relative aspect-[4/3] rounded-3xl border border-white/5 bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(222,47%,4%)] overflow-hidden">
                        <div className="absolute inset-0 opacity-30"
                          style={{ backgroundImage: "radial-gradient(circle at 30% 30%, hsl(187,92%,50%/0.25), transparent 50%), radial-gradient(circle at 70% 70%, hsl(262,83%,58%/0.25), transparent 50%)" }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] blur-2xl opacity-40" />
                            <div className="relative h-28 w-28 rounded-3xl bg-[hsl(222,47%,8%)] border border-white/10 flex items-center justify-center">
                              <layer.icon className="h-12 w-12 text-[hsl(187,92%,50%)]" />
                            </div>
                          </div>
                        </div>
                        {/* corner badge */}
                        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/40 backdrop-blur border border-white/10 text-[10px] uppercase tracking-widest text-white/60">
                          Layer {String(idx + 1).padStart(2, "0")}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Personas ===== */}
      <section className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-4xl md:text-6xl font-bold mb-4">
                An AI solution for{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  every person in engineering
                </span>
              </h2>
              <p className="text-white/50 text-lg">Your core workflows, powered by Qualixa agents.</p>
            </div>
          </Reveal>

          <Tabs defaultValue={personas[0].key} className="w-full">
            <TabsList className="mx-auto flex flex-wrap justify-center gap-2 bg-transparent h-auto p-0 mb-12">
              {personas.map((p) => (
                <TabsTrigger
                  key={p.key}
                  value={p.key}
                  className="px-5 py-2.5 rounded-full border border-white/10 bg-[hsl(222,47%,6%)] text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(187,92%,50%)] data-[state=active]:to-[hsl(262,83%,58%)] data-[state=active]:text-white data-[state=active]:border-transparent transition-all"
                >
                  <p.icon className="h-4 w-4 mr-2" />
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {personas.map((p) => (
              <TabsContent key={p.key} value={p.key} className="mt-0">
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/40 mb-4">Powered by Qualixa</div>
                    <h3 className="text-3xl md:text-5xl font-bold mb-6">{p.headline}</h3>
                    <p className="text-white/60 text-lg leading-relaxed mb-8">{p.body}</p>
                    <ul className="space-y-3 text-white/70">
                      <li className="flex gap-3"><Check className="h-5 w-5 text-[hsl(187,92%,50%)] mt-0.5" /> Comprehensive view: every signal at your fingertips</li>
                      <li className="flex gap-3"><Check className="h-5 w-5 text-[hsl(187,92%,50%)] mt-0.5" /> Strategic focus: AI handles the noise so you focus on vision</li>
                      <li className="flex gap-3"><Check className="h-5 w-5 text-[hsl(187,92%,50%)] mt-0.5" /> Instant answers: ask "who, when, why?" and get precise reports</li>
                    </ul>
                    <button onClick={() => navigate("/register")}
                      className="mt-8 inline-flex items-center gap-2 text-[hsl(187,92%,50%)] hover:text-white transition group">
                      Explore {p.label} solutions
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {p.agents.map((a) => (
                      <div key={a.name}
                        className="rounded-2xl p-6 bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] hover:-translate-y-1 transition-all">
                        <div className="text-3xl mb-3">{a.emoji}</div>
                        <div className="font-semibold mb-1">{a.name}</div>
                        <p className="text-sm text-white/50">{a.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* ===== AI Workbench Showcase ===== */}
      <section id="workbench" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Inside the Test Plan</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                The{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  AI Workbench
                </span>
              </h2>
              <p className="text-white/50 text-lg">
                A Monaco multi-tab editor that walks the AI through every step of building a runnable test suite — from project docs to per-case Playwright code — and dispatches it to your runners in one click.
              </p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            <Reveal>
              <div className="rounded-3xl border border-white/10 bg-[hsl(222,47%,5%)] overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[hsl(222,47%,7%)]">
                  <span className="h-3 w-3 rounded-full bg-red-500/70" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <span className="h-3 w-3 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-xs text-white/40 font-mono">AI Workbench · checkout-flow.spec.ts</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-[hsl(187,92%,50%)] px-2 py-0.5 rounded-full border border-[hsl(187,92%,50%)/0.3] bg-[hsl(187,92%,50%)/0.05]">chromium</span>
                    <button className="text-xs px-3 py-1 rounded-lg bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold inline-flex items-center gap-1.5">
                      <Play className="h-3 w-3 fill-current" /> Run Suite
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-[180px_1fr] min-h-[340px]">
                  <div className="border-r border-white/5 p-3 text-xs text-white/50 space-y-1 bg-[hsl(222,47%,6%)]">
                    {[
                      { n: "overview.md", a: true },
                      { n: "requirements.md" },
                      { n: "variables.md" },
                      { n: "benchmark.md" },
                      { n: "test-cases.md" },
                      { n: "checkout-flow.spec.ts", c: true },
                      { n: "login.spec.ts", c: true },
                      { n: "payment.spec.ts", c: true },
                    ].map((f) => (
                      <div key={f.n} className={`px-2 py-1 rounded ${f.a ? "bg-[hsl(187,92%,50%)/0.1] text-[hsl(187,92%,50%)]" : "hover:bg-white/5"}`}>
                        <span className={f.c ? "text-purple-300/70" : ""}>{f.n}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed text-white/70 overflow-hidden">
                    <div className="text-white/30"># Checkout Flow — generated by AI Workbench</div>
                    <div className="mt-2"><span className="text-[hsl(187,92%,50%)]">## Overview</span></div>
                    <div className="text-white/50">Validates the end-to-end checkout journey.</div>
                    <div className="mt-3"><span className="text-[hsl(187,92%,50%)]">## Requirements</span></div>
                    <div className="text-white/50">REQ-204 · REQ-218 · REQ-301</div>
                    <div className="mt-3"><span className="text-[hsl(187,92%,50%)]">## Variables</span></div>
                    <div className="text-white/50">{`{ env: "staging", currency: "USD" }`}</div>
                    <div className="mt-3"><span className="text-[hsl(187,92%,50%)]">## Benchmark</span></div>
                    <div className="text-white/50">p95 &lt; 1200ms · error rate &lt; 0.5%</div>
                    <div className="mt-3 flex items-center gap-2 text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Streaming: 7 / 12 cases passed
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <div className="space-y-5">
              {[
                { icon: FileText, title: "10 AI-decided docs", desc: "Overview, Requirements, Variables, Benchmark, Test Cases, and more — each project gets the docs it actually needs." },
                { icon: TestTube, title: "Cases + code per case", desc: "Generate test cases, then synthesize a Playwright .spec.ts for every single case in parallel." },
                { icon: ServerCog, title: "Registered runner dispatch", desc: "Run Suite ships your generated suite to any connected runner with browser, headless, and retry settings." },
                { icon: Zap, title: "Realtime suite progress", desc: "Per-case status updates stream into the Workbench as the runner executes — no refresh needed." },
                { icon: Database, title: "Artifact archive", desc: "Browse and download the exact docs JSON and .spec.ts files saved with every suite run." },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05}>
                  <div className="flex gap-4 p-5 rounded-2xl bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center shrink-0">
                      <f.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">{f.title}</div>
                      <p className="text-sm text-white/50">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stop guessing — bento ===== */}
      <section id="dna" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">The Qualixa Difference</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Stop guessing.{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  Start knowing.
                </span>
              </h2>
              <p className="text-white/50 text-lg">
                Other platforms track what your team ran. Qualixa reveals <em>how</em> your product behaves, <em>why</em> it fails, and <em>what</em> unlocks its quality.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bento.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.05}>
                <div className="group relative h-full rounded-3xl p-8 bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] transition-all hover:-translate-y-1">
                  <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-[hsl(187,92%,50%)/0.2] to-[hsl(262,83%,58%)/0.2] opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10" />
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center mb-6">
                    <b.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{b.title}</h3>
                  <p className="text-white/50 leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* spotlight rows */}
          <div className="mt-12 grid lg:grid-cols-3 gap-6">
            {[
              { title: "Intervene before it's too late.", body: "Instead of learning a feature broke after release, Qualixa alerts you weeks ahead.", tag: "Early Prediction" },
              { title: "Behind every release, a story.", body: "Qualixa builds a living quality profile per feature — patterns, strengths, and risks.", tag: "Deep Understanding" },
              { title: "12+ hours saved weekly.", body: "Triage, reporting, and follow-ups — all automated. Focus on the work that matters.", tag: "Your Time Back" },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 0.05}>
                <div className="rounded-3xl p-8 bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(222,47%,4%)] border border-white/5 h-full">
                  <div className="text-xs uppercase tracking-widest text-[hsl(187,92%,50%)] mb-3">{s.tag}</div>
                  <h4 className="text-2xl font-bold mb-3">{s.title}</h4>
                  <p className="text-white/50">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Day 1 / Day 2 / Day 3 ===== */}
      <section className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">From Disconnected to Unified</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Replace tool chaos with{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  one quality OS.
                </span>
              </h2>
              <p className="text-white/50 text-lg">
                Give your engineers one connected system for testing, evidence, and AI — so they spend less time troubleshooting and more time shipping.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {days.map((d, i) => (
              <Reveal key={d.day} delay={i * 0.1}>
                <div className="rounded-3xl p-8 h-full bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] transition-all flex flex-col">
                  <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">{d.day}</div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">{d.title}</h3>
                  <p className="text-white/50 mb-8 leading-relaxed">{d.body}</p>
                  <div className="mt-auto pt-6 border-t border-white/5">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">The Magic</div>
                    <p className="text-white/70 italic">"{d.magic}"</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Demo / Co-founder CTA ===== */}
      <section className="py-32">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-20" />
            <div className="absolute inset-0 animate-shimmer" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", backgroundSize: "200% 100%" }} />
            <div className="absolute inset-0 bg-[hsl(222,47%,6%)/0.85]" />
            <div className="relative p-12 md:p-20 text-center">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Co-Founder Program</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                See the OS{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  in action.
                </span>
              </h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto mb-10">
                We're accepting a limited number of "Co-Founder" engineering orgs this quarter. Priority support, custom implementation, and data migration included.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => navigate("/register")}
                  className="h-14 px-8 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold hover:shadow-xl hover:shadow-[hsl(187,92%,50%)/0.3] transition-all hover:-translate-y-0.5">
                  Become a Co-Founder
                </button>
                <Button size="lg" variant="outline"
                  className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Play className="mr-2 h-4 w-4 fill-current" /> Watch Demo
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-white/40 text-sm">
                <span>Priority support</span>
                <span className="h-1 w-1 rounded-full bg-white/20 self-center" />
                <span>Custom implementation</span>
                <span className="h-1 w-1 rounded-full bg-white/20 self-center" />
                <span>Data migration</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="py-20 relative">
        <div className="container max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[hsl(187,92%,50%)] via-white to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                {s.value}
              </div>
              <p className="mt-3 text-white/40 text-xs uppercase tracking-[0.25em]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-32 relative">
        <div className="container max-w-4xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">FAQ</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-4">
                Everything you need{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  to know.
                </span>
              </h2>
              <p className="text-white/50">Can't find what you're looking for? <a className="text-[hsl(187,92%,50%)] hover:underline" href="#">Contact our team.</a></p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}
                  className="rounded-2xl border border-white/5 bg-[hsl(222,47%,6%)] px-6 data-[state=open]:border-[hsl(187,92%,50%)/0.4]">
                  <AccordionTrigger className="text-left text-base md:text-lg hover:no-underline py-5">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/60 text-base leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ===== Privacy & Compliance ===== */}
      <section className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Privacy & Compliance</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Enterprise-grade{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  peace of mind.
                </span>
              </h2>
              <p className="text-white/50 text-lg">
                Your data stays safe and private with Qualixa. Third-party AI providers never store or learn from your information.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "No third-party AI training", desc: "We prevent third-party AI providers from training on your data." },
              { icon: Lock, title: "Zero third-party retention", desc: "We don't allow third-party AI providers to store any of your data." },
              { icon: Building2, title: "Multi-model support", desc: "Latest models, with unified permissions, privacy, and security controls." },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.05}>
                <div className="rounded-3xl p-8 h-full bg-[hsl(222,47%,6%)] border border-white/5 hover:border-[hsl(187,92%,50%)/0.4] transition-all">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center mb-6">
                    <c.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{c.title}</h3>
                  <p className="text-white/50">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Pricing</div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Choose your{" "}
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">plan</span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10">
                Start free and scale as you grow. No hidden fees, cancel anytime.
              </p>
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm ${!isYearly ? "text-white" : "text-white/40"}`}>Monthly</span>
                <Switch
                  checked={isYearly}
                  onCheckedChange={setIsYearly}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[hsl(187,92%,50%)] data-[state=checked]:to-[hsl(262,83%,58%)]"
                />
                <span className={`text-sm ${isYearly ? "text-white" : "text-white/40"}`}>
                  Yearly <span className="text-[hsl(187,92%,50%)]">(Save 20%)</span>
                </span>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((p) => (
              <PricingCard key={p.plan} {...p} isYearly={isYearly} onCta={() => navigate("/register")} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Vision ===== */}
      <section className="py-32 relative">
        <div className="container max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-4">Our Vision</div>
            <h2 className="text-4xl md:text-6xl font-bold mb-8">Our Vision</h2>
            <div className="space-y-6 text-lg md:text-xl text-white/60 leading-relaxed">
              <p>
                For decades, engineering teams have relied on test management tools designed as digital filing cabinets.
              </p>
              <p>
                Qualixa offers a new paradigm: a quality operating system.
              </p>
              <p className="text-white/80">
                At the heart of this vision lies <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent font-semibold">Qualixa DNA</span> — a living understanding of how your product behaves, so every release ships with confidence.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="py-20 border-t border-white/5">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <Logo size={48} />
                <span className="text-xl font-bold">Qualixa</span>
              </div>
              <p className="text-white/40 max-w-xs mb-6">
                The AI quality operating system for modern engineering teams.
              </p>
              <div className="flex gap-4">
                {["twitter", "linkedin", "github"].map((s) => (
                  <a key={s} href="#" className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-colors">
                    <Globe className="h-4 w-4 text-white/60" />
                  </a>
                ))}
              </div>
            </div>
            {[
              { title: "Product", links: ["Spaces", "Studio", "Quests", "DNA", "Pricing"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "GDPR"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-white/40 hover:text-white transition-colors text-sm">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-sm">© 2026 Qualixa. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== Animations ===== */}
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse-slow { 0%,100% { opacity: 0.08; transform: scale(1); } 50% { opacity: 0.12; transform: scale(1.05); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        .animate-shimmer { animation: shimmer 3s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animation-delay-200 { animation-delay: 0.2s; opacity: 0; }
        .animation-delay-400 { animation-delay: 0.4s; opacity: 0; }
        .animation-delay-600 { animation-delay: 0.6s; opacity: 0; }
        .animation-delay-1000 { animation-delay: 1s; opacity: 0; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
}

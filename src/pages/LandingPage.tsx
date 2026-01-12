import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  ChevronDown,
  Star,
  Shield,
  Lock,
  Rocket,
  Zap,
  Globe,
  Check,
  X,
} from "lucide-react";

// Company logos for marquee
const companyLogos = [
  "TechCorp", "DataFlow", "CloudScale", "DevOps Pro", "QualityFirst",
  "TestMaster", "AgileWorks", "CodeStream", "InnovateTech", "ScaleUp"
];

// Simple card with CSS hover effects
const GlowCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div
      ref={ref}
      className={`relative group will-change-transform ${className}`}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(30px)',
        transition: `all 0.5s ease-out ${delay}s`,
      }}
    >
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-0 group-hover:opacity-60 blur-sm transition-opacity duration-300" />
      <div className="relative rounded-2xl bg-[hsl(222,47%,8%)] p-6 h-full border border-white/5 group-hover:border-transparent transition-all duration-300 group-hover:-translate-y-2">
        {children}
      </div>
    </div>
  );
};

// Pricing card component
const PricingCard = ({ 
  plan, 
  price, 
  yearlyPrice, 
  isYearly, 
  features, 
  isPopular, 
  ctaText,
  onCta 
}: { 
  plan: string; 
  price: number; 
  yearlyPrice: number;
  isYearly: boolean; 
  features: { text: string; included: boolean }[];
  isPopular?: boolean;
  ctaText: string;
  onCta: () => void;
}) => {
  const displayPrice = isYearly ? yearlyPrice : price;
  
  return (
    <div className={`relative group ${isPopular ? 'scale-105 z-10' : ''}`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-sm font-medium">
          Most Popular
        </div>
      )}
      <div className={`relative rounded-2xl p-8 h-full transition-all duration-300 ${
        isPopular 
          ? 'bg-gradient-to-b from-[hsl(222,47%,10%)] to-[hsl(222,47%,6%)] border-2 border-[hsl(187,92%,50%)/0.5] shadow-[0_0_40px_-10px_hsl(187,92%,50%/0.3)]' 
          : 'bg-[hsl(222,47%,8%)] border border-white/10 hover:border-white/20'
      }`}>
        <h3 className="text-2xl font-bold mb-2">{plan}</h3>
        <div className="mb-6">
          <span className="text-5xl font-bold">${displayPrice}</span>
          <span className="text-white/50">/{isYearly ? 'year' : 'month'}</span>
          {isYearly && price > 0 && (
            <p className="text-sm text-[hsl(187,92%,50%)] mt-1">Save ${(price * 12) - yearlyPrice}/year</p>
          )}
        </div>
        
        <ul className="space-y-3 mb-8">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3">
              {feature.included ? (
                <Check className="h-5 w-5 text-[hsl(187,92%,50%)] shrink-0" />
              ) : (
                <X className="h-5 w-5 text-white/20 shrink-0" />
              )}
              <span className={feature.included ? 'text-white/80' : 'text-white/30'}>{feature.text}</span>
            </li>
          ))}
        </ul>
        
        <button
          onClick={onCta}
          className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
            isPopular 
              ? 'bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white hover:shadow-lg hover:shadow-[hsl(187,92%,50%)/0.3] hover:-translate-y-1' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {ctaText}
        </button>
      </div>
    </div>
  );
};

const features = [
  { icon: TestTube, title: "Test Case Management", description: "Create, organize, and track test cases with version control and requirements traceability.", color: "from-cyan-400 to-blue-500" },
  { icon: Play, title: "Execution Tracking", description: "Execute tests manually or automatically, track progress in real-time with detailed results.", color: "from-green-400 to-emerald-500" },
  { icon: Bot, title: "AI-Powered Testing", description: "Leverage intelligent agents that learn from your patterns and generate test cases automatically.", color: "from-purple-400 to-pink-500" },
  { icon: Bug, title: "Defect Management", description: "Track, assign, and resolve bugs with severity levels, priority, and linked test executions.", color: "from-red-400 to-orange-500" },
  { icon: FileText, title: "Document Processing", description: "Upload requirements documents and let AI extract test scenarios automatically.", color: "from-blue-400 to-indigo-500" },
  { icon: BarChart3, title: "Advanced Analytics", description: "Visualize trends, coverage heatmaps, team performance, and quality metrics in real-time.", color: "from-yellow-400 to-orange-500" },
  { icon: Bell, title: "Real-Time Notifications", description: "Get instant alerts when tests complete, defects are assigned, or quality issues arise.", color: "from-pink-400 to-rose-500" },
  { icon: GitBranch, title: "Integrations", description: "Connect with GitHub, Jira, Jenkins, Slack, and other tools in your development workflow.", color: "from-teal-400 to-cyan-500" },
];

const stats = [
  { value: "99.9%", label: "Uptime Guarantee" },
  { value: "50%", label: "Faster Testing" },
  { value: "10x", label: "AI Productivity" },
  { value: "24/7", label: "Expert Support" },
];

const workflowSteps = [
  { step: "01", title: "Import Requirements", description: "Upload documents or connect to your project management tools.", icon: FileText },
  { step: "02", title: "Generate Test Cases", description: "AI analyzes requirements and creates comprehensive test scenarios.", icon: Sparkles },
  { step: "03", title: "Execute & Monitor", description: "Run tests with real-time tracking and automated defect detection.", icon: Rocket },
  { step: "04", title: "Analyze & Improve", description: "Get insights, coverage reports, and AI-driven recommendations.", icon: BarChart3 },
];

const testimonials = [
  { quote: "Qualixa transformed our QA process. We reduced testing time by 60% while improving coverage.", author: "Sarah Chen", role: "VP of Engineering", company: "TechScale Inc.", avatar: "SC" },
  { quote: "The AI-powered test generation is incredible. It catches edge cases we never thought of.", author: "Marcus Williams", role: "QA Director", company: "FinFlow Systems", avatar: "MW" },
  { quote: "Finally, a QA platform that understands enterprise needs. The analytics alone are worth it.", author: "Elena Rodriguez", role: "CTO", company: "CloudNative Labs", avatar: "ER" },
];

const pricingPlans = [
  {
    plan: "Free",
    price: 0,
    yearlyPrice: 0,
    ctaText: "Get Started",
    features: [
      { text: "Up to 5 users", included: true },
      { text: "100 test cases", included: true },
      { text: "Basic reporting", included: true },
      { text: "Email support", included: true },
      { text: "AI test generation", included: false },
      { text: "Custom integrations", included: false },
      { text: "Advanced analytics", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    plan: "Pro",
    price: 49,
    yearlyPrice: 470,
    ctaText: "Start Free Trial",
    isPopular: true,
    features: [
      { text: "Up to 25 users", included: true },
      { text: "Unlimited test cases", included: true },
      { text: "Advanced reporting", included: true },
      { text: "Priority email support", included: true },
      { text: "AI test generation", included: true },
      { text: "GitHub & Jira integration", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Priority support", included: false },
    ],
  },
  {
    plan: "Enterprise",
    price: 199,
    yearlyPrice: 1990,
    ctaText: "Contact Sales",
    features: [
      { text: "Unlimited users", included: true },
      { text: "Unlimited test cases", included: true },
      { text: "Custom reporting", included: true },
      { text: "24/7 phone support", included: true },
      { text: "AI test generation", included: true },
      { text: "All integrations", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Dedicated success manager", included: true },
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [isYearly, setIsYearly] = useState(false);
  
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax transforms - GPU accelerated
  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.5], [1, 0]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-white overflow-x-hidden">
      {/* Static CSS background effects - no JS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(187,92%,50%)] opacity-[0.08] blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.08] blur-[120px] animate-pulse-slow animation-delay-2000" />
      </div>

      {/* Grid overlay - static CSS */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(187 92% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(187 92% 50%) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 animate-fade-in-down">
        <div className="mx-4 mt-4">
          <div className="container max-w-7xl mx-auto px-6 py-4 rounded-2xl bg-[hsl(222,47%,6%)/0.7] backdrop-blur-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 hover:scale-[1.02] transition-transform duration-200">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] blur-lg opacity-40" />
                  <div className="relative h-11 w-11 rounded-xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                    <TestTube className="h-5 w-5 text-white" />
                  </div>
                </div>
                <span className="text-xl font-bold tracking-tight">Qualixa</span>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                {["Features", "Workflow", "Testimonials", "Pricing"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="relative text-sm text-white/60 hover:text-white transition-colors py-2 group"
                  >
                    {item}
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  </a>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  className="text-white/70 hover:text-white hover:bg-white/5" 
                  onClick={() => navigate("/login")}
                >
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

      {/* Hero Section with Parallax */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-32 pb-20">
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="container max-w-7xl mx-auto px-6 relative z-10 will-change-transform"
        >
          <div className="text-center max-w-5xl mx-auto">
            {/* Animated badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-xl animate-fade-in-up">
              <Sparkles className="h-4 w-4 text-[hsl(187,92%,50%)] animate-spin-slow" />
              <span className="text-sm bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent font-medium">
                AI-Powered Quality Intelligence Platform
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-[10px] font-bold uppercase">
                New
              </span>
            </div>
            
            {/* Hero heading */}
            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight animate-fade-in-up animation-delay-200">
              <span className="block">Quality Assurance</span>
              <span className="relative inline-block mt-2">
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(220,90%,60%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  Reimagined
                </span>
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] rounded-full animate-scale-x animation-delay-1000" />
              </span>
              <span className="block mt-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                with AI
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/50 mb-12 max-w-3xl mx-auto leading-relaxed font-light animate-fade-in-up animation-delay-400">
              Transform your testing workflow with intelligent automation, real-time analytics, 
              and AI-powered insights that help you ship{" "}
              <span className="text-white font-medium">better software</span>, faster.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-600">
              <button
                onClick={() => navigate("/register")}
                className="group relative h-16 px-10 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold text-lg overflow-hidden hover:shadow-xl hover:shadow-[hsl(187,92%,50%)/0.3] transition-all duration-300 hover:-translate-y-1"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Free Trial
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="h-16 px-10 text-lg rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1"
                onClick={() => navigate("/login")}
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Watch Demo
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-16 flex items-center justify-center gap-8 text-white/30 text-sm animate-fade-in animation-delay-1000">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>SOC 2 Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Enterprise Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span>4.9/5 Rating</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-fade-in animation-delay-1500">
          <div className="flex flex-col items-center gap-2 text-white/30 animate-bounce-slow">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="relative py-20 -mt-20">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-15 blur-3xl rounded-3xl group-hover:opacity-25 transition-opacity duration-500" />
            
            {/* Dashboard mockup */}
            <div className="relative rounded-3xl border border-white/10 bg-[hsl(222,47%,6%)] p-3 shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="w-full max-w-md mx-auto h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <span className="text-xs text-white/30">app.qualixa.io/dashboard</span>
                  </div>
                </div>
              </div>
              
              {/* Dashboard content */}
              <div className="rounded-2xl bg-[hsl(222,47%,5%)] p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { icon: CheckCircle, value: "94.2%", label: "Pass Rate", color: "cyan" },
                    { icon: TestTube, value: "1,247", label: "Test Cases", color: "purple" },
                    { icon: Bot, value: "87%", label: "AI Coverage", color: "green" },
                    { icon: Zap, value: "12ms", label: "Avg. Response", color: "yellow" },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      className="relative group/stat"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] opacity-0 group-hover/stat:opacity-15 rounded-xl blur-xl transition-opacity duration-300" />
                      <div className="relative rounded-xl bg-white/5 border border-white/5 p-5 hover:border-white/10 transition-colors duration-300">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-r ${
                            stat.color === "cyan" ? "from-cyan-500/20 to-blue-500/20" :
                            stat.color === "purple" ? "from-purple-500/20 to-pink-500/20" :
                            stat.color === "green" ? "from-green-500/20 to-emerald-500/20" :
                            "from-yellow-500/20 to-orange-500/20"
                          } flex items-center justify-center`}>
                            <stat.icon className={`h-5 w-5 ${
                              stat.color === "cyan" ? "text-cyan-400" :
                              stat.color === "purple" ? "text-purple-400" :
                              stat.color === "green" ? "text-green-400" :
                              "text-yellow-400"
                            }`} />
                          </div>
                        </div>
                        <p className="text-3xl font-bold mb-1">{stat.value}</p>
                        <p className="text-white/40 text-sm">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Chart placeholder */}
                <div className="mt-6 h-48 rounded-xl bg-white/5 border border-white/5 flex items-end justify-center gap-2 p-6">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, i) => (
                    <div
                      key={i}
                      className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] animate-grow-up"
                      style={{ 
                        height: `${height}%`,
                        animationDelay: `${0.5 + i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Logos Marquee */}
      <section className="py-16 border-y border-white/5 overflow-hidden">
        <div className="container max-w-7xl mx-auto px-6 mb-8">
          <p className="text-center text-white/40 text-sm uppercase tracking-widest">Trusted by innovative teams worldwide</p>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[hsl(222,47%,4%)] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[hsl(222,47%,4%)] to-transparent z-10" />
          <div className="flex animate-marquee">
            {[...companyLogos, ...companyLogos].map((logo, i) => (
              <div key={i} className="flex-shrink-0 mx-12 flex items-center justify-center">
                <div className="px-8 py-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xl font-bold text-white/40">{logo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="text-center"
              >
                <div className="mb-4">
                  <span className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-[hsl(187,92%,50%)] via-white to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                    {stat.value}
                  </span>
                </div>
                <p className="text-white/40 text-sm uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
              Powerful Features
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="block">Everything You Need for</span>
              <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                World-Class Testing
              </span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              A complete quality assurance platform with AI-powered features that adapt to your workflow.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <GlowCard key={feature.title} delay={index * 0.05}>
                <div className={`h-14 w-14 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-5`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/40 leading-relaxed">{feature.description}</p>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-32 relative overflow-hidden">
        <div className="container max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
              Simple Process
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              How <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">Qualixa</span> Works
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              From requirements to release, streamline your entire quality process in four simple steps.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-24 left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-30" />
            
            {workflowSteps.map((step, index) => (
              <div
                key={step.step}
                className="relative text-center"
              >
                {/* Step number with glow */}
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] rounded-full blur-xl opacity-40" />
                  <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                    <span className="text-2xl font-bold">{step.step}</span>
                  </div>
                </div>
                
                <div className="h-14 w-14 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                  <step.icon className="h-7 w-7 text-[hsl(187,92%,50%)]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-white/40">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
              Testimonials
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Trusted by <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">Industry Leaders</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <GlowCard key={testimonial.author} delay={index * 0.1} className="h-full">
                {/* Quote */}
                <div className="mb-6">
                  <svg className="h-8 w-8 text-[hsl(187,92%,50%)] opacity-50" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
                  </svg>
                </div>
                <p className="text-lg text-white/70 mb-8 leading-relaxed">"{testimonial.quote}"</p>
                
                {/* Author */}
                <div className="flex items-center gap-4 mt-auto">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-white/40">{testimonial.role}, {testimonial.company}</p>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
              Simple Pricing
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Choose Your <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">Plan</span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto mb-10">
              Start free and scale as you grow. No hidden fees, cancel anytime.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm ${!isYearly ? 'text-white' : 'text-white/40'}`}>Monthly</span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[hsl(187,92%,50%)] data-[state=checked]:to-[hsl(262,83%,58%)]"
              />
              <span className={`text-sm ${isYearly ? 'text-white' : 'text-white/40'}`}>
                Yearly <span className="text-[hsl(187,92%,50%)]">(Save 20%)</span>
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <PricingCard
                key={plan.plan}
                {...plan}
                isYearly={isYearly}
                onCta={() => navigate("/register")}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="relative rounded-[2.5rem] overflow-hidden">
            {/* Animated background - CSS only */}
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-20" />
            <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', backgroundSize: '200% 100%' }} />
            <div className="absolute inset-0 bg-[hsl(222,47%,6%)/0.9]" />
            
            <div className="relative p-16 md:p-24 text-center">
              <h2 className="text-5xl md:text-7xl font-bold mb-8">
                <span className="block">Ready to Transform</span>
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  Your Quality Process?
                </span>
              </h2>
              <p className="text-white/50 text-xl max-w-2xl mx-auto mb-12">
                Join thousands of teams already using Qualixa to ship better software, faster.
                Start your free trial today—no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate("/register")}
                  className="group relative h-16 px-12 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold text-lg overflow-hidden hover:shadow-xl hover:shadow-[hsl(187,92%,50%)/0.3] transition-all duration-300 hover:-translate-y-1"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Free Trial
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-16 px-12 text-lg rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all duration-300"
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                  <TestTube className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">Qualixa</span>
              </div>
              <p className="text-white/40 max-w-xs mb-6">
                AI-powered quality intelligence platform for modern development teams.
              </p>
              <div className="flex gap-4">
                {["twitter", "linkedin", "github"].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-colors duration-300"
                  >
                    <Globe className="h-4 w-4 text-white/60" />
                  </a>
                ))}
              </div>
            </div>
            
            {[
              { title: "Product", links: ["Features", "Integrations", "Pricing", "Changelog"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "GDPR"] },
            ].map((column) => (
              <div key={column.title}>
                <h4 className="font-semibold mb-4">{column.title}</h4>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-white/40 hover:text-white transition-colors duration-300 text-sm">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-sm">
              © 2026 Qualixa. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white transition-colors duration-300">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors duration-300">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors duration-300">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-x {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes grow-up {
          from { height: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.12; transform: scale(1.05); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        .animate-scale-x { animation: scale-x 0.8s ease-out forwards; transform-origin: left; }
        .animate-grow-up { animation: grow-up 0.5s ease-out forwards; }
        .animate-shimmer { animation: shimmer 3s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 4s linear infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animation-delay-200 { animation-delay: 0.2s; opacity: 0; }
        .animation-delay-400 { animation-delay: 0.4s; opacity: 0; }
        .animation-delay-600 { animation-delay: 0.6s; opacity: 0; }
        .animation-delay-1000 { animation-delay: 1s; opacity: 0; }
        .animation-delay-1500 { animation-delay: 1.5s; opacity: 0; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
}

import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TestTube,
  Bot,
  FileText,
  Bug,
  BarChart3,
  Shield,
  Zap,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Play,
  Sparkles,
  Layers,
  GitBranch,
  Bell,
  Settings,
  Globe,
  ChevronDown,
  Star,
  Cpu,
  Lock,
  Rocket,
} from "lucide-react";

// Floating particles component
const FloatingParticles = () => {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)]"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// Animated gradient orbs
const GradientOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full"
      style={{
        background: "radial-gradient(circle, hsl(187 92% 50% / 0.15) 0%, transparent 70%)",
      }}
      animate={{
        x: [0, 100, 0],
        y: [0, 50, 0],
        scale: [1, 1.2, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full"
      style={{
        background: "radial-gradient(circle, hsl(262 83% 58% / 0.15) 0%, transparent 70%)",
      }}
      animate={{
        x: [0, -100, 0],
        y: [0, -50, 0],
        scale: [1.2, 1, 1.2],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
      style={{
        background: "radial-gradient(circle, hsl(199 89% 48% / 0.1) 0%, transparent 70%)",
      }}
      animate={{
        scale: [1, 1.3, 1],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
    />
  </div>
);

// Animated counter component
const AnimatedCounter = ({ value, suffix = "" }: { value: string; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
      className="inline-block"
    >
      {value}{suffix}
    </motion.span>
  );
};

// Magnetic button effect
const MagneticButton = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (clientX - left - width / 2) * 0.15;
    const y = (clientY - top - height / 2) * 0.15;
    setPosition({ x, y });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  return (
    <motion.button
      ref={ref}
      className={className}
      onClick={onClick}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.button>
  );
};

// Glowing border card
const GlowCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.3 }}
      whileHover={{ 
        y: -8, 
        transition: { duration: 0.3 } 
      }}
      className={`relative group ${className}`}
    >
      {/* Animated border gradient */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-0 group-hover:opacity-70 transition-opacity duration-500" 
        style={{ backgroundSize: "200% 200%", animation: "gradient-shift 3s linear infinite" }}
      />
      {/* Card content */}
      <div className="relative rounded-2xl bg-[hsl(222,47%,8%)] p-6 h-full">
        {children}
      </div>
    </motion.div>
  );
};

const features = [
  {
    icon: TestTube,
    title: "Test Case Management",
    description: "Create, organize, and track test cases with version control and requirements traceability.",
    color: "from-cyan-400 to-blue-500",
  },
  {
    icon: Play,
    title: "Execution Tracking",
    description: "Execute tests manually or automatically, track progress in real-time with detailed results.",
    color: "from-green-400 to-emerald-500",
  },
  {
    icon: Bot,
    title: "AI-Powered Testing",
    description: "Leverage intelligent agents that learn from your patterns and generate test cases automatically.",
    color: "from-purple-400 to-pink-500",
  },
  {
    icon: Bug,
    title: "Defect Management",
    description: "Track, assign, and resolve bugs with severity levels, priority, and linked test executions.",
    color: "from-red-400 to-orange-500",
  },
  {
    icon: FileText,
    title: "Document Processing",
    description: "Upload requirements documents and let AI extract test scenarios automatically.",
    color: "from-blue-400 to-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Visualize trends, coverage heatmaps, team performance, and quality metrics in real-time.",
    color: "from-yellow-400 to-orange-500",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications",
    description: "Get instant alerts when tests complete, defects are assigned, or quality issues arise.",
    color: "from-pink-400 to-rose-500",
  },
  {
    icon: GitBranch,
    title: "Integrations",
    description: "Connect with GitHub, Jira, Jenkins, Slack, and other tools in your development workflow.",
    color: "from-teal-400 to-cyan-500",
  },
];

const stats = [
  { value: "99.9", suffix: "%", label: "Uptime Guarantee" },
  { value: "50", suffix: "%", label: "Faster Testing" },
  { value: "10", suffix: "x", label: "AI Productivity" },
  { value: "24/7", suffix: "", label: "Expert Support" },
];

const workflowSteps = [
  {
    step: "01",
    title: "Import Requirements",
    description: "Upload documents or connect to your project management tools.",
    icon: FileText,
  },
  {
    step: "02",
    title: "Generate Test Cases",
    description: "AI analyzes requirements and creates comprehensive test scenarios.",
    icon: Sparkles,
  },
  {
    step: "03",
    title: "Execute & Monitor",
    description: "Run tests with real-time tracking and automated defect detection.",
    icon: Rocket,
  },
  {
    step: "04",
    title: "Analyze & Improve",
    description: "Get insights, coverage reports, and AI-driven recommendations.",
    icon: BarChart3,
  },
];

const testimonials = [
  {
    quote: "Qualixa transformed our QA process. We reduced testing time by 60% while improving coverage.",
    author: "Sarah Chen",
    role: "VP of Engineering",
    company: "TechScale Inc.",
    avatar: "SC",
  },
  {
    quote: "The AI-powered test generation is incredible. It catches edge cases we never thought of.",
    author: "Marcus Williams",
    role: "QA Director",
    company: "FinFlow Systems",
    avatar: "MW",
  },
  {
    quote: "Finally, a QA platform that understands enterprise needs. The analytics alone are worth it.",
    author: "Elena Rodriguez",
    role: "CTO",
    company: "CloudNative Labs",
    avatar: "ER",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax transforms
  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroScrollProgress, [0, 0.5], [1, 0.95]);
  
  // Smooth spring animations
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Mouse position for cursor effects
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[hsl(222,47%,4%)] text-white overflow-x-hidden">
      {/* Custom cursor glow */}
      <motion.div
        className="fixed w-[500px] h-[500px] rounded-full pointer-events-none z-0 opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(187 92% 50% / 0.15) 0%, transparent 70%)",
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
        }}
        animate={{
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 30 }}
      />

      {/* Global background elements */}
      <GradientOrbs />
      <FloatingParticles />

      {/* Grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(187 92% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(187 92% 50%) 1px, transparent 1px)`,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-4 mt-4">
          <div className="container max-w-7xl mx-auto px-6 py-4 rounded-2xl bg-[hsl(222,47%,6%)/0.6] backdrop-blur-2xl border border-white/5">
            <div className="flex items-center justify-between">
              <motion.div 
                className="flex items-center gap-3"
                whileHover={{ scale: 1.02 }}
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] blur-lg opacity-50" />
                  <div className="relative h-11 w-11 rounded-xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                    <TestTube className="h-5 w-5 text-white" />
                  </div>
                </div>
                <span className="text-xl font-bold tracking-tight">Qualixa</span>
              </motion.div>
              
              <div className="hidden md:flex items-center gap-8">
                {["Features", "Workflow", "Testimonials", "Pricing"].map((item) => (
                  <motion.a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="relative text-sm text-white/60 hover:text-white transition-colors py-2"
                    whileHover={{ y: -2 }}
                  >
                    {item}
                    <motion.span
                      className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)]"
                      initial={{ scaleX: 0 }}
                      whileHover={{ scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.a>
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
                <MagneticButton
                  onClick={() => navigate("/register")}
                  className="relative px-6 py-2.5 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-medium text-sm overflow-hidden group"
                >
                  <span className="relative z-10">Get Started</span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)]"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                </MagneticButton>
              </div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section with Parallax */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-32 pb-20">
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="container max-w-7xl mx-auto px-6 relative z-10"
        >
          <div className="text-center max-w-5xl mx-auto">
            {/* Animated badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-xl"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4 w-4 text-[hsl(187,92%,50%)]" />
              </motion.div>
              <span className="text-sm bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent font-medium">
                AI-Powered Quality Intelligence Platform
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-[10px] font-bold uppercase">
                New
              </span>
            </motion.div>
            
            {/* Hero heading with staggered animation */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-6xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight"
            >
              <span className="block">Quality Assurance</span>
              <span className="relative inline-block mt-2">
                <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(220,90%,60%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                  Reimagined
                </span>
                <motion.span
                  className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 1 }}
                />
              </span>
              <span className="block mt-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                with AI
              </span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-xl md:text-2xl text-white/50 mb-12 max-w-3xl mx-auto leading-relaxed font-light"
            >
              Transform your testing workflow with intelligent automation, real-time analytics, 
              and AI-powered insights that help you ship{" "}
              <span className="text-white font-medium">better software</span>, faster.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <MagneticButton
                onClick={() => navigate("/register")}
                className="group relative h-16 px-10 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold text-lg overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Free Trial
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </motion.span>
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)]"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.5 }}
                />
              </MagneticButton>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="h-16 px-10 text-lg rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 backdrop-blur-xl"
                onClick={() => navigate("/login")}
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="mt-16 flex items-center justify-center gap-8 text-white/30 text-sm"
            >
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
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-white/30"
          >
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Animated Dashboard Preview */}
      <section className="relative py-20 -mt-20">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 100, rotateX: 45 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, type: "spring", bounce: 0.2 }}
            className="relative perspective-1000"
          >
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-20 blur-3xl rounded-3xl" />
            
            {/* Dashboard mockup */}
            <div className="relative rounded-3xl border border-white/10 bg-[hsl(222,47%,6%)] p-3 shadow-2xl overflow-hidden">
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
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="relative group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] opacity-0 group-hover:opacity-20 rounded-xl blur-xl transition-opacity" />
                      <div className="relative rounded-xl bg-white/5 border border-white/5 p-5 hover:border-white/10 transition-colors">
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
                    </motion.div>
                  ))}
                </div>
                
                {/* Chart placeholder */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 h-48 rounded-xl bg-white/5 border border-white/5 flex items-end justify-center gap-2 p-6"
                >
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, i) => (
                    <motion.div
                      key={i}
                      className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)]"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${height}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8 + i * 0.05, duration: 0.5, type: "spring" }}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="text-center group"
              >
                <div className="mb-4">
                  <span className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-[hsl(187,92%,50%)] via-white to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </span>
                </div>
                <p className="text-white/40 text-sm uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6"
            >
              Powerful Features
            </motion.span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="block">Everything You Need for</span>
              <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">
                World-Class Testing
              </span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              A complete quality assurance platform with AI-powered features that adapt to your workflow.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <GlowCard key={feature.title} delay={index * 0.1}>
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
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6"
            >
              Simple Process
            </motion.span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              How <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">Qualixa</span> Works
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              From requirements to release, streamline your entire quality process in four simple steps.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-24 left-[12.5%] right-[12.5%] h-[2px]">
              <motion.div
                className="h-full bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)]"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
            </div>
            
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                className="relative text-center"
              >
                {/* Step number with glow */}
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] rounded-full blur-xl opacity-50" />
                  <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                    <span className="text-2xl font-bold">{step.step}</span>
                  </div>
                </div>
                
                <div className="h-14 w-14 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                  <step.icon className="h-7 w-7 text-[hsl(187,92%,50%)]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-white/40">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 relative">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6"
            >
              Testimonials
            </motion.span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Trusted by <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">Industry Leaders</span>
            </h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <GlowCard key={testimonial.author} delay={index * 0.15} className="h-full">
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

      {/* CTA Section */}
      <section className="py-32">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-[2.5rem] overflow-hidden"
          >
            {/* Animated background */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(187,92%,50%)] via-[hsl(262,83%,58%)] to-[hsl(187,92%,50%)] opacity-20" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="absolute inset-0 bg-[hsl(222,47%,6%)/0.9]" />
            
            <div className="relative p-16 md:p-24 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
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
                  <MagneticButton
                    onClick={() => navigate("/register")}
                    className="group relative h-16 px-12 rounded-2xl bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white font-semibold text-lg overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Start Free Trial
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </MagneticButton>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="h-16 px-12 text-lg rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Contact Sales
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.div>
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
                    className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-colors"
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
                      <a href="#" className="text-white/40 hover:text-white transition-colors text-sm">
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
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS for gradient animation */}
      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

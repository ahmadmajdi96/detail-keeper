import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const features = [
  {
    icon: TestTube,
    title: "Test Case Management",
    description: "Create, organize, and track test cases with version control and requirements traceability.",
  },
  {
    icon: Play,
    title: "Execution Tracking",
    description: "Execute tests manually or automatically, track progress in real-time with detailed results.",
  },
  {
    icon: Bot,
    title: "AI-Powered Testing",
    description: "Leverage intelligent agents that learn from your patterns and generate test cases automatically.",
  },
  {
    icon: Bug,
    title: "Defect Management",
    description: "Track, assign, and resolve bugs with severity levels, priority, and linked test executions.",
  },
  {
    icon: FileText,
    title: "Document Processing",
    description: "Upload requirements documents and let AI extract test scenarios automatically.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Visualize trends, coverage heatmaps, team performance, and quality metrics in real-time.",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications",
    description: "Get instant alerts when tests complete, defects are assigned, or quality issues arise.",
  },
  {
    icon: GitBranch,
    title: "Integrations",
    description: "Connect with GitHub, Jira, Jenkins, Slack, and other tools in your development workflow.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "50%", label: "Faster Testing" },
  { value: "10x", label: "AI Productivity" },
  { value: "24/7", label: "Support" },
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
    icon: Play,
  },
  {
    step: "04",
    title: "Analyze & Improve",
    description: "Get insights, coverage reports, and AI-driven recommendations.",
    icon: BarChart3,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(222,47%,6%)/0.8] backdrop-blur-xl border-b border-white/5">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl landing-gradient flex items-center justify-center">
                <TestTube className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Qualixa</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">Features</a>
              <a href="#workflow" className="text-sm text-white/70 hover:text-white transition-colors">How it Works</a>
              <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/login")}>
                Sign In
              </Button>
              <Button className="landing-gradient text-white border-0 hover:opacity-90" onClick={() => navigate("/register")}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(187,92%,50%)] opacity-10 blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-10 blur-[150px]" />
        </div>
        
        <div className="container max-w-7xl mx-auto px-6 relative">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <Sparkles className="h-4 w-4 text-[hsl(187,92%,50%)]" />
              <span className="text-sm text-white/70">AI-Powered Quality Intelligence Platform</span>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Quality Assurance
              <br />
              <span className="landing-gradient-text">Reimagined with AI</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
              Transform your testing workflow with intelligent automation, real-time analytics, 
              and AI-powered insights that help you ship better software, faster.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="landing-gradient text-white border-0 hover:opacity-90 h-14 px-8 text-lg"
                onClick={() => navigate("/register")}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-14 px-8 text-lg border-white/20 text-white hover:bg-white/10"
                onClick={() => navigate("/login")}
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>
          
          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 landing-gradient opacity-20 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl border border-white/10 bg-[hsl(222,47%,8%)] p-2 shadow-2xl">
              <div className="rounded-xl bg-[hsl(222,47%,7%)] p-6 min-h-[400px] flex items-center justify-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                  <div className="landing-card rounded-xl p-6 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-[hsl(187,92%,50%)/0.2] flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-[hsl(187,92%,50%)]" />
                      </div>
                      <span className="text-3xl font-bold">94.2%</span>
                    </div>
                    <p className="text-white/60 text-sm">Pass Rate</p>
                  </div>
                  <div className="landing-card rounded-xl p-6 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-[hsl(262,83%,58%)/0.2] flex items-center justify-center">
                        <TestTube className="h-5 w-5 text-[hsl(262,83%,58%)]" />
                      </div>
                      <span className="text-3xl font-bold">1,247</span>
                    </div>
                    <p className="text-white/60 text-sm">Test Cases</p>
                  </div>
                  <div className="landing-card rounded-xl p-6 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-[hsl(160,84%,39%)/0.2] flex items-center justify-center">
                        <Bot className="h-5 w-5 text-[hsl(160,84%,39%)]" />
                      </div>
                      <span className="text-3xl font-bold">87%</span>
                    </div>
                    <p className="text-white/60 text-sm">AI Coverage</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-white/5">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold landing-gradient-text mb-2">{stat.value}</p>
                <p className="text-white/50 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need for
              <br />
              <span className="landing-gradient-text">World-Class Testing</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              A complete quality assurance platform with AI-powered features that adapt to your workflow.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="landing-card rounded-xl p-6 transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-xl landing-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-24 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-[hsl(262,83%,58%)] opacity-5 blur-[150px]" />
          <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full bg-[hsl(187,92%,50%)] opacity-5 blur-[150px]" />
        </div>
        
        <div className="container max-w-7xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How <span className="landing-gradient-text">Qualixa</span> Works
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              From requirements to release, streamline your entire quality process in four simple steps.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-full h-[2px] bg-gradient-to-r from-[hsl(187,92%,50%)/0.5] to-transparent" />
                )}
                <div className="text-6xl font-bold landing-gradient-text opacity-30 mb-4">{step.step}</div>
                <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <step.icon className="h-6 w-6 text-[hsl(187,92%,50%)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-white/50 text-sm">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 landing-gradient opacity-20" />
            <div className="absolute inset-0 bg-[hsl(222,47%,8%)/0.8]" />
            <div className="relative p-12 md:p-20 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Transform Your
                <br />
                <span className="landing-gradient-text">Quality Process?</span>
              </h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto mb-10">
                Join thousands of teams already using Qualixa to ship better software, faster.
                Start your free trial today—no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  size="lg" 
                  className="landing-gradient text-white border-0 hover:opacity-90 h-14 px-10 text-lg"
                  onClick={() => navigate("/register")}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-14 px-10 text-lg border-white/20 text-white hover:bg-white/10"
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/5">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl landing-gradient flex items-center justify-center">
                  <TestTube className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">Qualixa</span>
              </div>
              <p className="text-white/50 text-sm max-w-xs">
                AI-powered quality intelligence platform for modern development teams.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">© 2026 Qualixa. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <Globe className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
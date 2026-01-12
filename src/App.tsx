import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import DocumentsPage from "./pages/DocumentsPage";
import TestPlansPage from "./pages/TestPlansPage";
import UsersPage from "./pages/UsersPage";
import TestCasesPage from "./pages/TestCasesPage";
import ExecutionsPage from "./pages/ExecutionsPage";
import AutomationPage from "./pages/AutomationPage";
import ReportingPage from "./pages/ReportingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/test-plans" element={<TestPlansPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/test-cases" element={<TestCasesPage />} />
            <Route path="/executions" element={<ExecutionsPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/reporting" element={<ReportingPage />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

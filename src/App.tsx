import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import DocumentsPage from "./pages/DocumentsPage";
import TestPlansPage from "./pages/TestPlansPage";
import UsersPage from "./pages/UsersPage";
import TestCasesPage from "./pages/TestCasesPage";
import TestCaseEditorPage from "./pages/TestCaseEditorPage";
import ExecutionsPage from "./pages/ExecutionsPage";
import AutomationPage from "./pages/AutomationPage";
import ReportingPage from "./pages/ReportingPage";
import NotificationsPage from "./pages/NotificationsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import DefectsPage from "./pages/DefectsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationProvider>
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
              <Route path="/test-cases/new" element={<TestCaseEditorPage />} />
              <Route path="/test-cases/:id/edit" element={<TestCaseEditorPage />} />
              <Route path="/executions" element={<ExecutionsPage />} />
              <Route path="/defects" element={<DefectsPage />} />
              <Route path="/automation" element={<AutomationPage />} />
              <Route path="/reporting" element={<ReportingPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ActiveTestPlanProvider } from "@/contexts/ActiveTestPlanContext";
import DefectDetailPage from "./pages/DefectDetailPage";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import WorkspaceDetailPage from "./pages/WorkspaceDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import DocumentsPage from "./pages/DocumentsPage";
import TestPlansPage from "./pages/TestPlansPage";
import TestPlanDetailPage from "./pages/TestPlanDetailPage";
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
import ReleasesPage from "./pages/ReleasesPage";
import CyclesPage from "./pages/CyclesPage";
import CycleDetailPage from "./pages/CycleDetailPage";
import RequirementsPage from "./pages/RequirementsPage";
import QualityGatesPage from "./pages/QualityGatesPage";
import RunnersPage from "./pages/RunnersPage";
import { AdminLayout } from "./admin/AdminLayout";
import AdminOverviewPage from "./admin/pages/AdminOverviewPage";
import RepositoriesPage from "./admin/pages/RepositoriesPage";
import RequirementVersionsPage from "./admin/pages/RequirementVersionsPage";
import DefectsAdminPage from "./admin/pages/DefectsAdminPage";
import ApprovalsPage from "./admin/pages/ApprovalsPage";
import AIJobsPage from "./admin/pages/AIJobsPage";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
        <NotificationProvider>
          <ActiveTestPlanProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              {/* Landing Page - Main Route */}
              <Route path="/" element={<LandingPage />} />
              
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Protected Routes - All authenticated users */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* Protected Routes - QA Engineer and above */}
              <Route path="/workspaces" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <WorkspacesPage />
                </ProtectedRoute>
              } />
              <Route path="/workspaces/:id" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <WorkspaceDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <ProjectsPage />
                </ProtectedRoute>
              } />
              <Route path="/documents" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <DocumentsPage />
                </ProtectedRoute>
              } />
              <Route path="/test-plans" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <TestPlansPage />
                </ProtectedRoute>
              } />
              <Route path="/test-plans/:id" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <TestPlanDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/test-cases" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <TestCasesPage />
                </ProtectedRoute>
              } />
              <Route path="/test-cases/new" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <TestCaseEditorPage />
                </ProtectedRoute>
              } />
              <Route path="/test-cases/:id/edit" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <TestCaseEditorPage />
                </ProtectedRoute>
              } />
              <Route path="/executions" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <ExecutionsPage />
                </ProtectedRoute>
              } />
              <Route path="/releases" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <ReleasesPage />
                </ProtectedRoute>
              } />
              <Route path="/cycles" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <CyclesPage />
                </ProtectedRoute>
              } />
              <Route path="/cycles/:id" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <CycleDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/requirements" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <RequirementsPage />
                </ProtectedRoute>
              } />
              <Route path="/quality-gates" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <QualityGatesPage />
                </ProtectedRoute>
              } />
              <Route path="/runners" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <RunnersPage />
                </ProtectedRoute>
              } />




              <Route path="/defects" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <DefectsPage />
                </ProtectedRoute>
              } />
              <Route path="/defects/:id" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <DefectDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/automation" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <AutomationPage />
                </ProtectedRoute>
              } />
              <Route path="/reporting" element={
                <ProtectedRoute allowedRoles={["qa_engineer", "qa_manager", "admin"]}>
                  <ReportingPage />
                </ProtectedRoute>
              } />
              
              {/* Admin Routes - QA Manager and Admin only */}
              <Route path="/users" element={
                <ProtectedRoute allowedRoles={["qa_manager", "admin"]}>
                  <UsersPage />
                </ProtectedRoute>
              } />
              <Route path="/integrations" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <IntegrationsPage />
                </ProtectedRoute>
              } />
              
              {/* Isolated Admin Console */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="repositories" element={<RepositoriesPage />} />
                <Route path="requirement-versions" element={<RequirementVersionsPage />} />
                <Route path="defects" element={<DefectsAdminPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="ai-jobs" element={<AIJobsPage />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ActiveTestPlanProvider>
      </NotificationProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

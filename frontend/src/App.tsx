import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./shared/components/ProtectedRoute";
import AdminRoute from "./shared/components/AdminRoute";
import AppShell from "./shared/components/AppShell";
import LoginPage from "./features/auth/pages/LoginPage";
import PhoneVerificationPage from "./features/phone-verification/pages/PhoneVerificationPage";
import DashboardPage from "./features/dashboard/pages/DashboardPage";
import ProfilePage from "./features/profile/pages/ProfilePage";
import BrowseWorkersPage from "./features/workers/pages/BrowseWorkersPage";
import WorkerOnboardingPage from "./features/workers/pages/WorkerOnboardingPage";
import AdminDashboardPage from "./features/admin/dashboard/pages/AdminDashboardPage";
import AdminRolesPage from "./features/admin/role_management/pages/AdminRolesPage";
import AdminCachesPage from "./features/admin/caches/pages/AdminCachesPage";
import AdminCategoriesPage from "./features/admin/category_management/pages/AdminCategoriesPage";
import AdminApprovalsPage from "./features/admin/worker_approval/pages/AdminApprovalsPage";
import AdminWorkerDetailPage from "./features/admin/worker_approval/pages/AdminWorkerDetailPage";
import SearchAnalyticsPage from "./features/admin/search_analytics/pages/SearchAnalyticsPage";

// Task pages
import MyTasksPage from "./features/tasks/pages/MyTasksPage";
import AvailableTasksPage from "./features/tasks/pages/AvailableTasksPage";
import MyApplicationsPage from "./features/tasks/pages/MyApplicationsPage";
import TaskDetailPage from "./features/tasks/pages/TaskDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          {/* Full-screen flows (no bottom nav) */}
          <Route path="/verify-phone" element={<PhoneVerificationPage />} />
          <Route path="/become-worker" element={<WorkerOnboardingPage />} />

          {/* App shell with bottom nav */}
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/browse-workers" element={<BrowseWorkersPage />} />
            
            {/* Task routes */}
            <Route path="/tasks/my-tasks" element={<MyTasksPage />} />
            <Route path="/tasks/available" element={<AvailableTasksPage />} />
            <Route path="/tasks/my-applications" element={<MyApplicationsPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />

            {/* Admin routes — nested under ProtectedRoute + AppShell + AdminRoute */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/roles" element={<AdminRolesPage />} />
              <Route path="/admin/caches" element={<AdminCachesPage />} />
              <Route path="/admin/categories" element={<AdminCategoriesPage />} />
              <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
              <Route path="/admin/approvals/:userId" element={<AdminWorkerDetailPage />} />
              <Route path="/admin/search-analytics" element={<SearchAnalyticsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

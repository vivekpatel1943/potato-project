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

            {/* Admin routes — nested under ProtectedRoute + AppShell + AdminRoute */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/roles" element={<AdminRolesPage />} />
              <Route path="/admin/caches" element={<AdminCachesPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

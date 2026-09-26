import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../features/auth/stores/authStore";

/**
 * Route guard — only allows users with the "admin" role.
 * Redirects non-admins to the dashboard.
 */
export default function AdminRoute() {
  const role = useAuthStore((state) => state.role);

  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

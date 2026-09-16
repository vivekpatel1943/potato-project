import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../features/auth/stores/authStore";

/**
 * Route guard — wraps protected routes.
 * Renders child routes if authenticated, redirects to /login otherwise.
 */
export default function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

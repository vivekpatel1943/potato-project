import { useAuthStore } from "../../auth/stores/authStore";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { userName, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* Top bar */}
      <header className="bg-surface border-b border-border px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">🥔 Potato</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary hidden sm:inline">
              @{userName}
            </span>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="text-sm px-4 py-2 rounded-lg text-text-secondary
                hover:bg-primary-ghost hover:text-primary transition-all duration-200 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-md">
          <h2 className="text-2xl font-bold text-text mb-2">
            Welcome back, {userName}! 👋
          </h2>
          <p className="text-text-secondary">
            Your dashboard is ready. This is a placeholder page — your features
            will live here.
          </p>
        </div>
      </main>
    </div>
  );
}

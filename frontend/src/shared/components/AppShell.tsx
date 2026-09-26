import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../features/auth/stores/authStore";
import { useAppStore } from "../../features/app/stores/appStore";
import ModeSwitcher from "./ModeSwitcher";
import UserSync from "./UserSync";

// ── Icon Components ───────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

// ── Nav Tab Config ────────────────────────────────────────────────────────

interface NavTab {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  id: string;
}

const customerTabs: NavTab[] = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, id: "nav-home" },
  { to: "/browse-workers", label: "Workers", icon: SearchIcon, id: "nav-browse" },
  { to: "/profile", label: "Profile", icon: UserIcon, id: "nav-profile" },
];

const workerTabs: NavTab[] = [
  { to: "/dashboard", label: "Dashboard", icon: HomeIcon, id: "nav-dashboard" },
  { to: "/find-tasks", label: "Tasks", icon: BriefcaseIcon, id: "nav-tasks" },
  { to: "/profile", label: "Profile", icon: UserIcon, id: "nav-profile" },
];

// ── App Shell ─────────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate();
  const { userName, logout, role } = useAuthStore();
  const { mode } = useAppStore();

  const tabs = mode === "worker" ? workerTabs : customerTabs;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      {/* ── Top Header ─────────────────────────────────────────── */}
      <header className="bg-surface border-b border-border px-4 sm:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-text">🥔 Potato</h1>
          </NavLink>

          <div className="flex items-center gap-2 sm:gap-4">
            <ModeSwitcher />

            {role === "admin" && (
              <NavLink
                to="/admin"
                id="admin-link"
                className="text-sm px-3 py-1.5 rounded-lg text-amber-400
                  hover:bg-amber-400/10 transition-all duration-200"
              >
                ⚙ Admin
              </NavLink>
            )}

            <span className="text-sm text-text-secondary hidden sm:inline">
              @{userName}
            </span>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded-lg text-text-secondary
                hover:bg-primary-ghost hover:text-primary transition-all duration-200 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-24 sm:pb-8">
        <UserSync />
        <Outlet />
      </main>

      {/* ── Bottom Navigation (Mobile) ─────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.to}
              id={tab.id}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px]
                ${
                  isActive
                    ? "text-primary"
                    : "text-text-secondary hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon className={`w-6 h-6 ${isActive ? "stroke-[2.2]" : ""}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { NavLink } from "react-router-dom";

interface AdminCard {
  to: string;
  icon: string;
  title: string;
  description: string;
  ready: boolean;
}

const adminCards: AdminCard[] = [
  {
    to: "/admin/roles",
    icon: "👤",
    title: "Role Management",
    description: "Assign or revoke admin roles by email.",
    ready: true,
  },
  {
    to: "/admin/caches",
    icon: "📦",
    title: "Cache Management",
    description: "View and flush server-side Redis caches.",
    ready: true,
  },
  {
    to: "/admin/categories",
    icon: "📂",
    title: "Category Management",
    description: "Toggle visibility of service categories.",
    ready: true,
  },
  {
    to: "/admin/approvals",
    icon: "✅",
    title: "Worker Approvals",
    description: "Review and approve worker profiles.",
    ready: true,
  },
  {
    to: "/admin/search-analytics",
    icon: "📈",
    title: "Search Analytics",
    description: "See what customers search for, and where.",
    ready: true,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Admin Dashboard</h1>
        <p className="mt-1 text-text-secondary">
          Platform management and configuration.
        </p>
      </div>

      {/* Navigation cards grid — desktop optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {adminCards.map((card) =>
          card.ready ? (
            <NavLink
              key={card.title}
              to={card.to}
              className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm
                hover:border-primary-light hover:shadow-md transition-all duration-200 group"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h2 className="text-lg font-semibold text-text group-hover:text-primary transition-colors">
                {card.title}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {card.description}
              </p>
              <span className="inline-block mt-4 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Go →
              </span>
            </NavLink>
          ) : (
            <div
              key={card.title}
              className="bg-surface border border-dashed border-border rounded-2xl p-6 sm:p-8 opacity-60"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h2 className="text-lg font-semibold text-text">{card.title}</h2>
              <p className="text-sm text-text-secondary mt-1">
                {card.description}
              </p>
              <span className="inline-block mt-4 text-xs text-text-secondary">
                Coming soon
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

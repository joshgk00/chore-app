import { NavLink, Outlet } from "react-router-dom";

const adminLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/routines", label: "Routines" },
  { to: "/admin/chores", label: "Chores" },
  { to: "/admin/rewards", label: "Rewards" },
  { to: "/admin/approvals", label: "Approvals" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <nav aria-label="Admin navigation" className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-14 items-center gap-6 overflow-x-auto">
            <span className="shrink-0 font-bold text-indigo-600">Admin</span>
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `shrink-0 text-sm font-medium ${
                    isActive
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main id="main-content" className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  );
}

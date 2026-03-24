import { NavLink, Outlet, Link } from "react-router-dom";

const adminLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/routines", label: "Routines" },
  { to: "/admin/chores", label: "Chores" },
  { to: "/admin/rewards", label: "Rewards" },
  { to: "/admin/approvals", label: "Approvals" },
  { to: "/admin/ledger", label: "Ledger" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--color-amber-500)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <nav
        aria-label="Admin navigation"
        className="border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 overflow-x-auto px-6">
          <Link
            to="/admin"
            className="mr-4 flex shrink-0 items-center gap-2 font-display text-lg font-bold text-[var(--color-amber-600)]"
          >
            <span className="h-2 w-2 rounded-full bg-[var(--color-amber-400)]" aria-hidden="true" />
            Admin
          </Link>
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 border-b-2 px-3 py-4 text-[13px] font-semibold transition-colors ${
                  isActive
                    ? "border-[var(--color-amber-500)] text-[var(--color-amber-700)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <span className="flex-1" />
          <Link
            to="/today"
            className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-muted)]"
          >
            Exit Admin
          </Link>
        </div>
      </nav>
      <main id="main-content" className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}

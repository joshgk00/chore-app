import { NavLink, Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { api } from "../api/client.js";

const adminLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/routines", label: "Routines" },
  { to: "/admin/chores", label: "Chores" },
  { to: "/admin/rewards", label: "Rewards" },
  { to: "/admin/approvals", label: "Approvals" },
  { to: "/admin/ledger", label: "Ledger" },
  { to: "/admin/activity", label: "Activity" },
  { to: "/admin/settings", label: "Settings" },
];

function AdminErrorFallback() {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card">
      <p className="text-4xl" data-emoji>&#128679;</p>
      <h2 className="mt-4 font-display text-xl font-bold text-[var(--color-text)]">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        This admin page hit an unexpected error.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-6 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
      >
        Reload Page
      </button>
    </div>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Server session may remain but client state should still clear
    }
    queryClient.clear();
    navigate("/today");
  }

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
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-red-600)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            Logout
          </button>
        </div>
      </nav>
      <main id="main-content" className="mx-auto max-w-5xl p-6">
        <ErrorBoundary key={location.pathname} fallback={<AdminErrorFallback />}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

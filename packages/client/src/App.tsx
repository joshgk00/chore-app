import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSyncOnReconnect } from "./lib/draft-sync.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import BottomNav from "./components/BottomNav.js";
import AdminGuard from "./components/AdminGuard.js";
import AdminLayout from "./layouts/AdminLayout.js";
import Today from "./pages/Today.js";
import Routines from "./pages/Routines.js";
import Rewards from "./pages/Rewards.js";
import Me from "./pages/Me.js";
import RoutineChecklist from "./features/child/routines/RoutineChecklist.js";
import PinEntry from "./features/admin/pin/PinEntry.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    },
  },
});

function ChildErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="text-center">
        <p className="text-5xl" data-emoji>&#128517;</p>
        <h1 className="mt-4 text-xl font-bold text-[var(--color-text)]">Oops! Something broke.</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">Let's go back and try again.</p>
        <a
          href="/today"
          className="mt-6 inline-block rounded-full bg-[var(--color-emerald-500)] px-6 py-3 font-display font-bold text-white shadow-card"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div className="pb-16">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <ErrorBoundary fallback={<ChildErrorFallback />}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-gray-500">Coming soon.</p>
    </div>
  );
}

export default function App() {
  useSyncOnReconnect();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />

          <Route element={<AppShell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/routines" element={<Routines />} />
            <Route path="/routines/:id" element={<RoutineChecklist />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/me" element={<Me />} />
          </Route>

          <Route path="/admin/pin" element={<PinEntry />} />

          <Route element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminPlaceholder title="Admin Dashboard" />} />
              <Route path="/admin/routines" element={<AdminPlaceholder title="Routines" />} />
              <Route path="/admin/chores" element={<AdminPlaceholder title="Chores" />} />
              <Route path="/admin/rewards" element={<AdminPlaceholder title="Rewards" />} />
              <Route path="/admin/approvals" element={<AdminPlaceholder title="Approvals" />} />
              <Route path="/admin/settings" element={<AdminPlaceholder title="Settings" />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

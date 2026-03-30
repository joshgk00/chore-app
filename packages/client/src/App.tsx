import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSyncOnReconnect } from "./lib/draft-sync.js";
import { useManifestLink } from "./hooks/useManifestLink.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import BottomNav from "./components/BottomNav.js";
import AdminGuard from "./components/AdminGuard.js";
import AdminLayout from "./layouts/AdminLayout.js";
import OfflineBanner from "./components/OfflineBanner.js";
import TodayScreen from "./features/child/today/TodayScreen.js";
import RoutinesScreen from "./features/child/routines/RoutinesScreen.js";
import RewardsScreen from "./features/child/rewards/RewardsScreen.js";
import MeScreen from "./features/child/me/MeScreen.js";
import RoutineChecklist from "./features/child/routines/RoutineChecklist.js";
import PinEntry from "./features/admin/pin/PinEntry.js";
import AdminRoutinesList from "./features/admin/routines/AdminRoutinesList.js";
import AdminRoutineForm from "./features/admin/routines/AdminRoutineForm.js";
import AdminChoresList from "./features/admin/chores/AdminChoresList.js";
import AdminChoreForm from "./features/admin/chores/AdminChoreForm.js";
import AdminRewardsList from "./features/admin/rewards/AdminRewardsList.js";
import AdminRewardForm from "./features/admin/rewards/AdminRewardForm.js";
import ApprovalsScreen from "./features/admin/approvals/ApprovalsScreen.js";
import LedgerScreen from "./features/admin/ledger/LedgerScreen.js";
import ActivityLogScreen from "./features/admin/activity/ActivityLogScreen.js";
import SettingsScreen from "./features/admin/settings/SettingsScreen.js";
import AdminDashboard from "./features/admin/dashboard/AdminDashboard.js";
import RoutineHealthScreen from "./features/admin/routine-health/RoutineHealthScreen.js";
import ChoreEngagementScreen from "./features/admin/chore-engagement/ChoreEngagementScreen.js";
import SystemHealthScreen from "./features/admin/system-health/SystemHealthScreen.js";
import RewardDemandScreen from "./features/admin/reward-demand/RewardDemandScreen.js";

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
        <h1 className="mt-4 font-display text-xl font-bold text-[var(--color-text)]">Oops! Something broke.</h1>
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

function TabContent() {
  const location = useLocation();
  // Re-key on the top-level path segment so the fade-in replays on tab switch
  const tabKey = location.pathname.split("/")[1] || "today";

  return (
    <div key={tabKey} className="animate-tab-enter">
      <Outlet />
    </div>
  );
}

function AppShell() {
  return (
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--color-amber-500)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <ErrorBoundary fallback={<ChildErrorFallback />}>
          <TabContent />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  useManifestLink();

  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />

        <Route element={<AppShell />}>
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/routines" element={<RoutinesScreen />} />
          <Route path="/routines/:id" element={<RoutineChecklist />} />
          <Route path="/rewards" element={<RewardsScreen />} />
          <Route path="/me" element={<MeScreen />} />
        </Route>

        <Route path="/admin/pin" element={<PinEntry />} />

        <Route element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/routines" element={<AdminRoutinesList />} />
            <Route path="/admin/routines/new" element={<AdminRoutineForm />} />
            <Route path="/admin/routines/:id/edit" element={<AdminRoutineForm />} />
            <Route path="/admin/chores" element={<AdminChoresList />} />
            <Route path="/admin/chores/new" element={<AdminChoreForm />} />
            <Route path="/admin/chores/:id/edit" element={<AdminChoreForm />} />
            <Route path="/admin/rewards" element={<AdminRewardsList />} />
            <Route path="/admin/rewards/new" element={<AdminRewardForm />} />
            <Route path="/admin/rewards/:id/edit" element={<AdminRewardForm />} />
            <Route path="/admin/routine-health" element={<RoutineHealthScreen />} />
            <Route path="/admin/chore-engagement" element={<ChoreEngagementScreen />} />
            <Route path="/admin/system-health" element={<SystemHealthScreen />} />
            <Route path="/admin/reward-demand" element={<RewardDemandScreen />} />
            <Route path="/admin/approvals" element={<ApprovalsScreen />} />
            <Route path="/admin/ledger" element={<LedgerScreen />} />
            <Route path="/admin/activity" element={<ActivityLogScreen />} />
            <Route path="/admin/settings" element={<SettingsScreen />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  useSyncOnReconnect();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

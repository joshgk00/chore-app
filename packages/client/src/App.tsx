import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BottomNav from "./components/BottomNav.js";
import AdminGuard from "./components/AdminGuard.js";
import AdminLayout from "./layouts/AdminLayout.js";
import Today from "./pages/Today.js";
import Routines from "./pages/Routines.js";
import Rewards from "./pages/Rewards.js";
import Me from "./pages/Me.js";
import PinEntry from "./features/admin/pin/PinEntry.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ChildLayout() {
  return (
    <div className="pb-16">
      <Outlet />
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to today */}
          <Route path="/" element={<Navigate to="/today" replace />} />

          {/* Child routes with bottom nav */}
          <Route element={<ChildLayout />}>
            <Route path="/today" element={<Today />} />
            <Route path="/routines" element={<Routines />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/me" element={<Me />} />
          </Route>

          {/* Admin PIN entry (public) */}
          <Route path="/admin/pin" element={<PinEntry />} />

          {/* Protected admin routes */}
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

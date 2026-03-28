import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client.js";

export default function AdminGuard() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const location = useLocation();

  useEffect(() => {
    api.get<{ valid: boolean }>("/api/auth/session").then((result) => {
      setStatus(result.ok ? "authenticated" : "unauthenticated");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]" aria-live="polite" role="status">
        <p className="text-[var(--color-text-muted)]">Checking session...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/admin/pin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <Outlet />;
}

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../api/client.js";

export default function AdminGuard() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    api.get<{ valid: boolean }>("/api/auth/session").then((result) => {
      setStatus(result.ok ? "authenticated" : "unauthenticated");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-live="polite" role="status">
        <p className="text-gray-500">Checking session...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/admin/pin" replace />;
  }

  return <Outlet />;
}

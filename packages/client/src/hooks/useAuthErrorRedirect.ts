import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setOnAuthError } from "../api/client.js";

export function useAuthErrorRedirect(): void {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthError = useCallback(() => {
    const returnTo = location.pathname + location.search;
    navigate(`/admin/pin?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [navigate, location.pathname, location.search]);

  useEffect(() => {
    setOnAuthError(handleAuthError);
    return () => setOnAuthError(null);
  }, [handleAuthError]);
}

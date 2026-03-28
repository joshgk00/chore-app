import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * iOS PWAs always launch from the manifest's start_url regardless of the URL
 * the user was on when adding to home screen. This hook dynamically updates
 * the manifest link so admin pages get start_url=/admin in their manifest.
 */
export function useManifestLink() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;

    const href = isAdminRoute
      ? "/manifest.json?start_url=/admin"
      : "/manifest.json";

    if (link.href !== new URL(href, window.location.origin).href) {
      link.href = href;
    }
  }, [isAdminRoute]);
}

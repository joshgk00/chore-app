import { useOnline } from "../contexts/OnlineContext.js";

export default function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[var(--color-amber-100)] px-4 py-2 text-center text-sm font-medium text-[var(--color-amber-700)]"
    >
      You&apos;re offline. Changes can&apos;t be saved right now.
    </div>
  );
}

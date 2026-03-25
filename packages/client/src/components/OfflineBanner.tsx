import { useOnline } from "../contexts/OnlineContext.js";

export default function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-[var(--color-amber-100)] px-4 py-2 text-sm font-medium text-[var(--color-amber-700)]"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
      </svg>
      You&apos;re offline. Changes can&apos;t be saved right now.
    </div>
  );
}

import { useOnline } from "../../../contexts/OnlineContext.js";
import { usePushSupport } from "../../../lib/push.js";

export default function NotificationSettings() {
  const isOnline = useOnline();
  const push = usePushSupport();

  if (!push.isSupported) return null;

  return (
    <section
      className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card"
      aria-label="Notification settings"
    >
      <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
        Notifications
      </h2>
      <div className="mt-4">
        {push.permission === "granted" && (
          <div className="flex items-center gap-3" role="status">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--color-emerald-600)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Admin notifications are enabled.
            </p>
          </div>
        )}
        {push.permission === "denied" && (
          <p className="text-sm text-[var(--color-text-muted)]" role="status">
            Notifications are blocked. Update your browser settings to
            enable them.
          </p>
        )}
        {push.permission !== "granted" && push.permission !== "denied" && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Get notified when approvals are waiting.
            </p>
            <button
              type="button"
              onClick={() => push.subscribe("admin")}
              disabled={!isOnline || push.isSubscribing}
              className="min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
              aria-label="Enable admin notifications"
            >
              {push.isSubscribing ? "Enabling..." : "Enable"}
            </button>
          </div>
        )}
        {push.error && (
          <p className="mt-3 text-sm text-[var(--color-red-600)]" role="alert">
            {push.error}
          </p>
        )}
      </div>
    </section>
  );
}

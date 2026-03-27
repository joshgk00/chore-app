import { usePushSupport } from "../../../lib/push.js";

export default function NotificationOptIn() {
  const { isSupported, permission, subscribe, isSubscribing, error } =
    usePushSupport();

  if (!isSupported) {
    return (
      <div
        className="rounded-2xl bg-[var(--color-surface-muted)] p-4"
        role="status"
      >
        <p className="font-body text-sm text-[var(--color-text-muted)]">
          Notifications aren't available on this device.
        </p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        className="rounded-2xl bg-[var(--color-surface-muted)] p-4"
        role="status"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--color-red-600)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-display font-medium text-[var(--color-text-secondary)]">
              Notifications
            </p>
            <p className="mt-1 font-body text-sm text-[var(--color-text-muted)]">
              Notifications are blocked. Update your browser settings to enable
              them.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div
        className="rounded-2xl bg-[var(--color-surface-muted)] p-4"
        role="status"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--color-emerald-600)]"
            aria-hidden="true"
          />
          <p className="font-display font-medium text-[var(--color-text-secondary)]">
            Notifications enabled
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-medium text-[var(--color-text-secondary)]">
            Notifications
          </p>
          <p className="mt-1 font-body text-sm text-[var(--color-text-muted)]">
            Get reminders for your routines and chores.
          </p>
        </div>
        <button
          type="button"
          onClick={() => subscribe("child")}
          disabled={isSubscribing}
          className="min-h-touch rounded-full bg-[var(--color-amber-500)] px-4 py-2 font-display text-sm font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
          aria-label="Enable notifications"
        >
          {isSubscribing ? "Enabling..." : "Enable"}
        </button>
      </div>
      {error && (
        <p className="mt-2 font-body text-sm text-[var(--color-red-600)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

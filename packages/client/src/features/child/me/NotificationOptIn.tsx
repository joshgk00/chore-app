export default function NotificationOptIn() {
  return (
    <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--color-text-secondary)]">Notifications</p>
          <p className="text-sm text-[var(--color-text-muted)]">Coming soon!</p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-full bg-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-faint)]"
          aria-label="Enable notifications (coming soon)"
        >
          Off
        </button>
      </div>
    </div>
  );
}

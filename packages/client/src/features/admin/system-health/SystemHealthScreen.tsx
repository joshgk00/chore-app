import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { useAdminTimezone } from "../hooks/useAdminTimezone.js";
import { useSystemHealth } from "../hooks/useSystemHealth.js";
import { formatTimestamp } from "../../../lib/format-timestamp.js";
import { formatBytes } from "../utils/format-bytes.js";
import Card from "../../../components/Card.js";
import { DATETIME_OPTIONS } from "../utils/date-format-options.js";

function estimateCacheStorageBytes(): Promise<number | null> {
  if (!("storage" in navigator) || !navigator.storage?.estimate) {
    return Promise.resolve(null);
  }
  return navigator.storage.estimate().then(
    (estimate) => estimate.usage ?? null,
    () => null,
  );
}

function StatusDot({ status }: { status: "ok" | "warning" | "error" }) {
  const colors = {
    ok: "bg-[var(--color-emerald-500)]",
    warning: "bg-[var(--color-amber-500)]",
    error: "bg-[var(--color-red-600)]",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`}
    />
  );
}

export default function SystemHealthScreen() {
  const isOnline = useOnline();
  const timezone = useAdminTimezone();
  const { data, isLoading, error, refetch } = useSystemHealth(isOnline);
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [isCacheLoading, setIsCacheLoading] = useState(true);

  useEffect(() => {
    estimateCacheStorageBytes().then((size) => {
      setCacheSize(size);
      setIsCacheLoading(false);
    });
  }, []);

  const totalPushSubs = data
    ? data.pushSubscriptions.active +
      data.pushSubscriptions.expired +
      data.pushSubscriptions.failed
    : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin"
          className="text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          Dashboard
        </Link>
        <span className="text-[var(--color-text-muted)]">/</span>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          System Health
        </h1>
      </div>

      {!isOnline && !data && !isLoading && (
        <Card padding="p-6" className="text-center" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            System health data requires an internet connection.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-5">
          <div aria-live="polite" className="sr-only">
            Loading system health...
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-24 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-24 rounded-2xl bg-[var(--color-surface-muted)]" />
          </div>
        </div>
      )}

      {error && (
        <Card padding="p-6" className="text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Could not load system health data.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card"
          >
            Try Again
          </button>
        </Card>
      )}

      {data && (
        <div className="space-y-5">
          <Card as="section" aria-label="Database">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Database
            </h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Size
                </span>
                <span className="font-display text-lg font-bold text-[var(--color-text)]">
                  {formatBytes(data.databaseSizeBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Activity events
                </span>
                <span className="font-display text-lg font-bold text-[var(--color-text)]">
                  {data.activityEventCount.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          <Card as="section" aria-label="Backups">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Backups
            </h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Last backup
              </span>
              <div className="flex items-center gap-2">
                {data.lastBackupAt ? (
                  <>
                    <StatusDot status="ok" />
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {formatTimestamp(
                        data.lastBackupAt,
                        DATETIME_OPTIONS,
                        timezone,
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <StatusDot status="warning" />
                    <span className="text-sm font-semibold text-[var(--color-amber-700)]">
                      No backups yet
                    </span>
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card as="section" aria-label="Push notifications">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Push Notifications
            </h2>
            {totalPushSubs === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                No subscriptions registered
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status="ok" />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Active
                    </span>
                  </div>
                  <span className="font-display text-lg font-bold text-[var(--color-text)]">
                    {data.pushSubscriptions.active}
                  </span>
                </div>
                {data.pushSubscriptions.expired > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status="warning" />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Expired
                      </span>
                    </div>
                    <span className="font-display text-lg font-bold text-[var(--color-text)]">
                      {data.pushSubscriptions.expired}
                    </span>
                  </div>
                )}
                {data.pushSubscriptions.failed > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status="error" />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Failed
                      </span>
                    </div>
                    <span className="font-display text-lg font-bold text-[var(--color-text)]">
                      {data.pushSubscriptions.failed}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card as="section" aria-label="Client storage">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Client Storage
            </h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Estimated usage
              </span>
              {isCacheLoading ? (
                <span className="text-sm text-[var(--color-text-muted)]">
                  Checking...
                </span>
              ) : cacheSize !== null ? (
                <span className="font-display text-lg font-bold text-[var(--color-text)]">
                  {formatBytes(cacheSize)}
                </span>
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">
                  N/A
                </span>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

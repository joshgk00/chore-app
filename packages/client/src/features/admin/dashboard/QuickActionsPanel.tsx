import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys, invalidatePointsRelated } from "../../../lib/query-keys.js";
import Card from "../../../components/Card.js";
import type {
  PendingApprovals,
  BatchApproveResult,
  PointsEconomy,
} from "@chore-app/shared";

interface QuickActionsPanelProps {
  pendingApprovals: PendingApprovals | undefined;
}

function useBatchApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await api.post<BatchApproveResult>(
        "/api/admin/approvals/batch-approve",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.approvals() });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-log"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.ledger() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.pointsEconomy(),
      });
      invalidatePointsRelated(queryClient);
    },
  });
}

function usePointsEconomy(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.pointsEconomy(),
    queryFn: async () => {
      const result = await api.get<PointsEconomy>(
        "/api/admin/points/economy",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
  });
}

function useBackupExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch("/api/admin/export", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "chore-app-backup.zip";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Failed to export backup. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportError, handleExport };
}

function TrendIndicator({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  if (lastWeek === 0 && thisWeek === 0) return null;

  const isUp = thisWeek > lastWeek;
  const isDown = thisWeek < lastWeek;

  if (!isUp && !isDown) return null;

  return (
    <span
      className={`ml-1 text-xs font-semibold ${
        isUp
          ? "text-[var(--color-emerald-600)]"
          : "text-[var(--color-red-600)]"
      }`}
      aria-label={isUp ? "Trending up from last week" : "Trending down from last week"}
    >
      {isUp ? "\u2191" : "\u2193"}
    </span>
  );
}

export default function QuickActionsPanel({
  pendingApprovals,
}: QuickActionsPanelProps) {
  const isOnline = useOnline();
  const batchApprove = useBatchApprove();
  const economy = usePointsEconomy(isOnline);
  const backup = useBackupExport();

  const [isConfirmingBatchApprove, setIsConfirmingBatchApprove] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchApproveResult | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);

  const totalPending =
    (pendingApprovals?.routineCompletions.length ?? 0) +
    (pendingApprovals?.choreLogs.length ?? 0) +
    (pendingApprovals?.rewardRequests.length ?? 0);

  useEffect(() => {
    if (isConfirmingBatchApprove && confirmDialogRef.current) {
      const firstButton =
        confirmDialogRef.current.querySelector<HTMLButtonElement>("button");
      firstButton?.focus();
    }
  }, [isConfirmingBatchApprove]);

  function handleBatchApproveConfirm() {
    batchApprove.mutate(undefined, {
      onSuccess: (data) => {
        setBatchResult(data);
        setIsConfirmingBatchApprove(false);
      },
      onError: () => {
        setIsConfirmingBatchApprove(false);
      },
    });
  }

  return (
    <Card as="section" aria-label="Quick actions">
      <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
        Quick Actions
      </h2>

      <div className="mt-4 space-y-4">
        <div>
          {!isConfirmingBatchApprove ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmingBatchApprove(true)}
                disabled={!isOnline || totalPending === 0 || batchApprove.isPending}
                title={
                  !isOnline
                    ? "You're offline"
                    : totalPending === 0
                      ? "No pending items"
                      : undefined
                }
                className="min-h-touch rounded-xl bg-[var(--color-emerald-500)] px-4 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-emerald-600)] disabled:opacity-50"
              >
                {batchApprove.isPending ? "Approving..." : "Approve All"}
              </button>
              {totalPending > 0 && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  {totalPending} pending
                </span>
              )}
            </div>
          ) : (
            <div
              ref={confirmDialogRef}
              className="rounded-xl border border-[var(--color-amber-500)] bg-[var(--color-surface-muted)] p-4"
              role="alertdialog"
              aria-label="Confirm batch approve"
            >
              <p className="font-display font-bold text-[var(--color-text)]">
                Approve all {totalPending} pending items?
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                This will approve all pending routines, chores, and rewards at once.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleBatchApproveConfirm}
                  disabled={!isOnline || batchApprove.isPending}
                  className="min-h-touch rounded-xl bg-[var(--color-emerald-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-emerald-600)] disabled:opacity-50"
                >
                  {batchApprove.isPending ? "Approving..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingBatchApprove(false)}
                  disabled={batchApprove.isPending}
                  className="min-h-touch rounded-xl border border-[var(--color-border)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {batchApprove.error && (
            <p className="mt-2 text-sm text-[var(--color-red-600)]" role="alert">
              Batch approve failed. Please try again.
            </p>
          )}

          {batchResult && (
            <p className="mt-2 text-sm text-[var(--color-emerald-600)]" role="status">
              Approved {batchResult.approvedCount} item
              {batchResult.approvedCount !== 1 ? "s" : ""}
              {batchResult.failedCount > 0 &&
                ` (${batchResult.failedCount} failed)`}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Create New
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/routines/new"
              className="rounded-lg bg-[var(--color-sky-50)] px-3 py-1.5 text-sm font-semibold text-[var(--color-sky-700)] transition-colors hover:bg-[var(--color-sky-100)]"
            >
              + Routine
            </Link>
            <Link
              to="/admin/chores/new"
              className="rounded-lg bg-[var(--color-amber-50)] px-3 py-1.5 text-sm font-semibold text-[var(--color-amber-700)] transition-colors hover:bg-[var(--color-amber-100)]"
            >
              + Chore
            </Link>
            <Link
              to="/admin/rewards/new"
              className="rounded-lg bg-[var(--color-amber-50)] px-3 py-1.5 text-sm font-semibold text-[var(--color-amber-700)] transition-colors hover:bg-[var(--color-amber-100)]"
            >
              + Reward
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={backup.handleExport}
            disabled={!isOnline || backup.isExporting}
            title={!isOnline ? "You're offline" : undefined}
            className="min-h-touch rounded-xl border border-[var(--color-border)] px-4 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            {backup.isExporting ? "Exporting..." : "Export Backup"}
          </button>
          {backup.exportError && (
            <p className="text-sm text-[var(--color-red-600)]" role="alert">
              {backup.exportError}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[var(--color-surface-muted)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Points Economy
          </p>

          {economy.isLoading && (
            <div className="mt-2 animate-pulse space-y-2">
              <div className="h-4 w-32 rounded bg-[var(--color-surface)]" />
              <div className="h-4 w-24 rounded bg-[var(--color-surface)]" />
              <div aria-live="polite" className="sr-only">
                Loading points economy...
              </div>
            </div>
          )}

          {economy.error && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Could not load economy data.
            </p>
          )}

          {economy.data && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">This week:</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {economy.data.earnedThisWeek} pts
                </span>
                <TrendIndicator
                  thisWeek={economy.data.earnedThisWeek}
                  lastWeek={economy.data.earnedLastWeek}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">Last week:</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {economy.data.earnedLastWeek} pts
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">Total redeemed:</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {economy.data.redeemedAllTime} pts
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

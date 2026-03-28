import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { Reward } from "@chore-app/shared";

function useAdminRewards() {
  return useQuery({
    queryKey: queryKeys.admin.rewards(),
    queryFn: async () => {
      const result = await api.get<Reward[]>("/api/admin/rewards");
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

function useArchiveToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const endpoint = archived
        ? `/api/admin/rewards/${id}/unarchive`
        : `/api/admin/rewards/${id}/archive`;
      const result = await api.post<void>(endpoint);
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rewards() });
    },
  });
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">Loading rewards...</div>
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-2xl bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminRewardsList() {
  const isOnline = useOnline();
  const { data: rewards, isLoading, error, refetch } = useAdminRewards();
  const archiveToggle = useArchiveToggle();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          Rewards
        </h1>
        <Link
          to="/admin/rewards/new"
          className="inline-flex min-h-touch items-center rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          New Reward
        </Link>
      </div>

      <div className="mt-6">
        {isLoading && <LoadingSkeleton />}

        {error && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card"
            aria-live="assertive"
          >
            <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
              Could not load rewards.
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
            >
              Try Again
            </button>
          </div>
        )}

        {rewards && rewards.length === 0 && (
          <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card" aria-live="polite">
            <p className="text-4xl" data-emoji>&#127873;</p>
            <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
              No rewards yet
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Create your first reward to get started.
            </p>
          </div>
        )}

        {archiveToggle.error && (
          <div className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4" role="alert">
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              Failed to update reward status. Please try again.
            </p>
          </div>
        )}

        {rewards && rewards.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface)] shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Points Cost
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr
                    key={reward.id}
                    className={`border-b border-[var(--color-border-light)] last:border-b-0 ${
                      reward.archivedAt ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/rewards/${reward.id}/edit`}
                        className="font-body font-medium text-[var(--color-sky-700)] underline decoration-transparent transition-colors hover:decoration-[var(--color-sky-700)]"
                      >
                        {reward.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-display font-bold text-[var(--color-amber-700)]">
                      {reward.pointsCost}
                    </td>
                    <td className="px-4 py-3">
                      {reward.archivedAt ? (
                        <span className="inline-block rounded-full bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                          Archived
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-[var(--color-emerald-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-emerald-700)]">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          archiveToggle.reset();
                          archiveToggle.mutate({
                            id: reward.id,
                            archived: !!reward.archivedAt,
                          });
                        }}
                        disabled={archiveToggle.isPending || !isOnline}
                        className="min-h-touch rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {reward.archivedAt ? "Unarchive" : "Archive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

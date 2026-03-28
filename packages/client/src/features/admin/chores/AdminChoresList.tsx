import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { Chore } from "@chore-app/shared";

function useAdminChores() {
  return useQuery({
    queryKey: queryKeys.admin.chores(),
    queryFn: async () => {
      const result = await api.get<Chore[]>("/api/admin/chores");
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
        ? `/api/admin/chores/${id}/unarchive`
        : `/api/admin/chores/${id}/archive`;
      const result = await api.post<void>(endpoint);
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.chores() });
    },
  });
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">Loading chores...</div>
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

function tierCount(chore: Chore): number {
  return chore.tiers.filter((t) => !t.archivedAt).length;
}

export default function AdminChoresList() {
  const isOnline = useOnline();
  const { data: chores, isLoading, error, refetch } = useAdminChores();
  const archiveToggle = useArchiveToggle();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          Chores
        </h1>
        <Link
          to="/admin/chores/new"
          className="inline-flex min-h-touch items-center rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          New Chore
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
              Could not load chores.
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

        {chores && chores.length === 0 && (
          <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card" aria-live="polite">
            <p className="text-4xl" data-emoji>&#128203;</p>
            <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
              No chores yet
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Create your first chore to get started.
            </p>
          </div>
        )}

        {archiveToggle.error && (
          <div className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4" role="alert">
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              Failed to update chore status. Please try again.
            </p>
          </div>
        )}

        {chores && chores.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface)] shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Tiers
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
                {chores.map((chore) => (
                  <tr
                    key={chore.id}
                    className={`border-b border-[var(--color-border-light)] last:border-b-0 ${
                      chore.archivedAt ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/chores/${chore.id}/edit`}
                        className="font-body font-medium text-[var(--color-sky-700)] underline decoration-transparent transition-colors hover:decoration-[var(--color-sky-700)]"
                      >
                        {chore.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-body text-[var(--color-text-secondary)]">
                      {tierCount(chore)} {tierCount(chore) === 1 ? "tier" : "tiers"}
                    </td>
                    <td className="px-4 py-3">
                      {chore.archivedAt ? (
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
                        onClick={() =>
                          archiveToggle.mutate({
                            id: chore.id,
                            archived: !!chore.archivedAt,
                          })
                        }
                        disabled={archiveToggle.isPending || !isOnline}
                        className="min-h-touch rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {chore.archivedAt ? "Unarchive" : "Archive"}
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

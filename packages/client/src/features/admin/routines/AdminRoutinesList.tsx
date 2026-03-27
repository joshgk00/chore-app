import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import type { Routine } from "@chore-app/shared";

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  bedtime: "Bedtime",
  anytime: "Any Time",
};

const COMPLETION_RULE_LABELS: Record<string, string> = {
  once_per_day: "Once / day",
  once_per_slot: "Once / slot",
  unlimited: "Unlimited",
};

function useAdminRoutines() {
  return useQuery({
    queryKey: ["admin", "routines"],
    queryFn: async () => {
      const result = await api.get<Routine[]>("/api/admin/routines");
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
        ? `/api/admin/routines/${id}/unarchive`
        : `/api/admin/routines/${id}/archive`;
      const result = await api.post<void>(endpoint);
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "routines"] });
    },
  });
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">Loading routines...</div>
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

export default function AdminRoutinesList() {
  const isOnline = useOnline();
  const { data: routines, isLoading, error, refetch } = useAdminRoutines();
  const archiveToggle = useArchiveToggle();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          Routines
        </h1>
        <Link
          to="/admin/routines/new"
          className="inline-flex min-h-touch items-center rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          New Routine
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
              Could not load routines.
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

        {routines && routines.length === 0 && (
          <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card" aria-live="polite">
            <p className="text-4xl" data-emoji>&#128203;</p>
            <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
              No routines yet
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Create your first routine to get started.
            </p>
          </div>
        )}

        {archiveToggle.error && (
          <div className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4" role="alert">
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              Failed to update routine status. Please try again.
            </p>
          </div>
        )}

        {routines && routines.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface)] shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Time Slot
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Points
                  </th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Rule
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
                {routines.map((routine) => (
                  <tr
                    key={routine.id}
                    className={`border-b border-[var(--color-border-light)] last:border-b-0 ${
                      routine.archivedAt ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/routines/${routine.id}/edit`}
                        className="font-body font-medium text-[var(--color-sky-700)] underline decoration-transparent transition-colors hover:decoration-[var(--color-sky-700)]"
                      >
                        {routine.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-body text-[var(--color-text-secondary)]">
                      {TIME_SLOT_LABELS[routine.timeSlot] ?? routine.timeSlot}
                    </td>
                    <td className="px-4 py-3 font-display font-bold text-[var(--color-amber-700)]">
                      {routine.points}
                    </td>
                    <td className="px-4 py-3 font-body text-[var(--color-text-secondary)]">
                      {COMPLETION_RULE_LABELS[routine.completionRule] ?? routine.completionRule}
                    </td>
                    <td className="px-4 py-3">
                      {routine.archivedAt ? (
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
                            id: routine.id,
                            archived: !!routine.archivedAt,
                          })
                        }
                        disabled={archiveToggle.isPending || !isOnline}
                        className="min-h-touch rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {routine.archivedAt ? "Unarchive" : "Archive"}
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

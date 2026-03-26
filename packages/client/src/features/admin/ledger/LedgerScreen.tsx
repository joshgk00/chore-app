import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import HelpTip from "../../../components/HelpTip.js";
import type { PointsBalance, LedgerEntry, EntryType } from "@chore-app/shared";

const PAGE_SIZE = 50;

type FilterType = EntryType | "all";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "routine", label: "Routine" },
  { value: "chore", label: "Chore" },
  { value: "reward", label: "Reward" },
  { value: "manual", label: "Manual" },
];

interface LedgerResponse {
  entries: LedgerEntry[];
  balance: PointsBalance;
}

interface AdjustResponse {
  entry: LedgerEntry;
  balance: PointsBalance;
}

function useLedger(filter: FilterType) {
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "ledger", filter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filter !== "all") {
        params.set("entry_type", filter);
      }
      const result = await api.get<LedgerResponse>(
        `/api/admin/points/ledger?${params.toString()}`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
  });

  const entries = query.data?.entries ?? [];
  const hasMore = entries.length === PAGE_SIZE;

  function nextPage() {
    setPage((p) => p + 1);
  }

  function prevPage() {
    setPage((p) => Math.max(0, p - 1));
  }

  function resetPage() {
    setPage(0);
  }

  return {
    entries,
    balance: query.data?.balance ?? null,
    isLoading: query.isLoading,
    error: query.error,
    hasMore,
    page,
    nextPage,
    prevPage,
    resetPage,
    refetch: query.refetch,
  };
}

function useAdjustPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, note }: { amount: number; note: string }) => {
      const result = await api.post<AdjustResponse>("/api/admin/points/adjust", {
        amount,
        note,
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ledger"] });
    },
  });
}

function formatDate(dateStr: string): string {
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  return new Date(normalized).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount);
}

function entryTypeLabel(type: EntryType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">
        Loading ledger...
      </div>
      <div className="animate-pulse space-y-4">
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 flex-1 rounded-2xl bg-[var(--color-surface-muted)]"
            />
          ))}
        </div>
        <div className="h-10 w-48 rounded-lg bg-[var(--color-surface-muted)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    </div>
  );
}

function BalanceHeader({ balance }: { balance: PointsBalance }) {
  const cards = [
    { label: "Total", value: balance.total, helpId: "help-balance-total", helpText: "All points earned from routines, chores, and manual adjustments." },
    { label: "Reserved", value: balance.reserved, helpId: "help-balance-reserved", helpText: "Points held by pending reward requests that haven't been approved yet." },
    { label: "Available", value: balance.available, helpId: "help-balance-available", helpText: "Points the child can spend right now. This is Total minus Reserved minus already-spent points." },
  ];

  return (
    <div className="flex gap-3" role="group" aria-label="Points balance">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex-1 rounded-2xl bg-[var(--color-surface)] p-4 shadow-card"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {card.label}
            </span>
            <HelpTip id={card.helpId} text={card.helpText} />
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--color-amber-700)]">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

interface AdjustmentFormProps {
  isOnline: boolean;
  mutation: ReturnType<typeof useAdjustPoints>;
}

function AdjustmentForm({ isOnline, mutation }: AdjustmentFormProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; note?: string }>({});

  function validate(): boolean {
    const newErrors: { amount?: string; note?: string } = {};
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed === 0 || !Number.isInteger(parsed)) {
      newErrors.amount = "Enter a non-zero whole number";
    }
    if (!note.trim()) {
      newErrors.note = "A note is required for manual adjustments";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    mutation.mutate(
      { amount: Number(amount), note: note.trim() },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
          setErrors({});
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-card"
      aria-label="Manual point adjustment"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display text-base font-bold text-[var(--color-text)]">
          Manual Adjustment
        </h2>
        <HelpTip
          id="help-manual-adjust"
          text="Add or remove points directly. Use positive numbers to give bonus points, negative to deduct. A note is required so you remember why."
        />
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-shrink-0 sm:w-32">
          <label htmlFor="adjust-amount" className="block text-xs font-semibold text-[var(--color-text-muted)]">
            Amount
          </label>
          <input
            id="adjust-amount"
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            aria-describedby={errors.amount ? "adjust-amount-error" : undefined}
            aria-invalid={!!errors.amount}
            placeholder="+10 or -5"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
          />
          {errors.amount && (
            <p id="adjust-amount-error" className="mt-1 text-xs text-[var(--color-red-600)]">
              {errors.amount}
            </p>
          )}
        </div>
        <div className="flex-1">
          <label htmlFor="adjust-note" className="block text-xs font-semibold text-[var(--color-text-muted)]">
            Note
          </label>
          <input
            id="adjust-note"
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (errors.note) setErrors((prev) => ({ ...prev, note: undefined }));
            }}
            aria-describedby={errors.note ? "adjust-note-error" : undefined}
            aria-invalid={!!errors.note}
            placeholder="Reason for adjustment"
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
          />
          {errors.note && (
            <p id="adjust-note-error" className="mt-1 text-xs text-[var(--color-red-600)]">
              {errors.note}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 sm:pt-5">
          <button
            type="submit"
            disabled={!isOnline || mutation.isPending}
            className="min-h-touch w-full rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50 sm:w-auto"
          >
            {mutation.isPending ? "Saving..." : "Adjust"}
          </button>
        </div>
      </div>
      {mutation.error && (
        <div className="mt-3" role="alert">
          <p className="text-sm text-[var(--color-red-600)]">
            Failed to save adjustment. Please try again.
          </p>
        </div>
      )}
    </form>
  );
}

function TypeBadge({ type }: { type: EntryType }) {
  const colorMap: Record<EntryType, string> = {
    routine: "bg-[var(--color-sky-50)] text-[var(--color-sky-700)]",
    chore: "bg-[var(--color-amber-50)] text-[var(--color-amber-700)]",
    reward: "bg-[var(--color-amber-50)] text-[var(--color-amber-700)]",
    manual: "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colorMap[type]}`}
    >
      {entryTypeLabel(type)}
    </span>
  );
}

interface LedgerTableProps {
  entries: LedgerEntry[];
}

function LedgerTable({ entries }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface)] shadow-card">
      <table className="w-full text-sm" aria-label="Points ledger entries">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Type
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Amount
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              data-entry-type={entry.entryType}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                {formatDate(entry.createdAt)}
              </td>
              <td className="px-4 py-3">
                <TypeBadge type={entry.entryType} />
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-display font-bold ${
                  entry.amount > 0
                    ? "text-[var(--color-emerald-600)]"
                    : "text-[var(--color-red-600)]"
                }`}
              >
                {formatAmount(entry.amount)}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">
                {entry.note ?? "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LedgerScreen() {
  const isOnline = useOnline();
  const [filter, setFilter] = useState<FilterType>("all");
  const ledger = useLedger(filter);
  const adjustMutation = useAdjustPoints();

  function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter);
    ledger.resetPage();
  }

  const hasEntries = ledger.entries.length > 0;
  const isEmpty = !ledger.isLoading && !ledger.error && ledger.entries.length === 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Points Ledger
      </h1>

      <div className="mt-6 space-y-6">
        {ledger.isLoading && <LoadingSkeleton />}

        <div aria-live="polite">
          {!isOnline && !ledger.balance && !ledger.isLoading && (
            <div className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card">
              <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
                You're offline
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                The ledger requires an internet connection to load.
              </p>
            </div>
          )}
        </div>

        {isOnline && ledger.error && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card"
            aria-live="assertive"
          >
            <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
              Could not load the ledger.
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => ledger.refetch()}
              className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
            >
              Try Again
            </button>
          </div>
        )}

        {!ledger.isLoading && !ledger.error && (
          <>
            {ledger.balance && <BalanceHeader balance={ledger.balance} />}

            <AdjustmentForm isOnline={isOnline} mutation={adjustMutation} />

            <div className="flex items-center gap-3">
              <label htmlFor="ledger-filter" className="text-sm font-semibold text-[var(--color-text-muted)]">
                Filter
              </label>
              <select
                id="ledger-filter"
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value as FilterType)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {hasEntries && <LedgerTable entries={ledger.entries} />}

            {isEmpty && (
              <div
                className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card"
                aria-live="polite"
              >
                <p className="text-4xl" data-emoji>
                  &#128209;
                </p>
                <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
                  No ledger entries
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Points earned from routines, chores, and rewards will appear here.
                </p>
              </div>
            )}

            {hasEntries && (
              <div className="flex items-center justify-center gap-3">
                {ledger.page > 0 && (
                  <button
                    type="button"
                    onClick={ledger.prevPage}
                    className="min-h-touch rounded-xl bg-[var(--color-surface-muted)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    Previous
                  </button>
                )}
                <span className="text-sm text-[var(--color-text-muted)]">
                  Page {ledger.page + 1}
                </span>
                {ledger.hasMore && (
                  <button
                    type="button"
                    onClick={ledger.nextPage}
                    className="min-h-touch rounded-xl bg-[var(--color-surface-muted)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    Next
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import type { Chore } from "@chore-app/shared";

interface DraftTier {
  key: string;
  serverId?: number;
  name: string;
  points: number;
  sortOrder: number;
}

interface FormState {
  name: string;
  requiresApproval: boolean;
  sortOrder: number;
  tiers: DraftTier[];
}

interface FormErrors {
  name?: string;
  tiers?: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  requiresApproval: false,
  sortOrder: 0,
  tiers: [{ key: crypto.randomUUID(), name: "", points: 0, sortOrder: 0 }],
};

function useExistingChore(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "chores", id],
    queryFn: async () => {
      const result = await api.get<Chore>(`/api/admin/chores/${id}`);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: !!id,
  });
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) {
    errors.name = "Name is required";
  }
  const activeTiers = form.tiers.filter((tier) => tier.name.trim());
  if (activeTiers.length === 0) {
    errors.tiers = "At least one tier with a name is required";
  } else if (activeTiers.some((tier) => tier.points < 0)) {
    errors.tiers = "Tier points must be 0 or more";
  }
  return errors;
}

export default function AdminChoreForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOnline = useOnline();
  const { data: existing, isLoading: isLoadingExisting, error: loadError } = useExistingChore(id);

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasPopulated, setHasPopulated] = useState(false);

  useEffect(() => {
    if (existing && !hasPopulated) {
      setForm({
        name: existing.name,
        requiresApproval: existing.requiresApproval,
        sortOrder: existing.sortOrder,
        tiers: existing.tiers
          .filter((tier) => !tier.archivedAt)
          .map((tier) => ({
            key: String(tier.id),
            serverId: tier.id,
            name: tier.name,
            points: tier.points,
            sortOrder: tier.sortOrder,
          })),
      });
      setHasPopulated(true);
    }
  }, [existing, hasPopulated]);

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const result = await api.post<Chore>("/api/admin/chores", {
        name: data.name.trim(),
        requiresApproval: data.requiresApproval,
        sortOrder: data.sortOrder,
        tiers: data.tiers
          .filter((tier) => tier.name.trim())
          .map((tier, idx) => ({ name: tier.name.trim(), points: tier.points, sortOrder: idx })),
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "chores"] });
      navigate("/admin/chores");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const activeTiers = data.tiers
        .filter((tier) => tier.name.trim())
        .map((tier, idx) => ({
          id: tier.serverId,
          name: tier.name.trim(),
          points: tier.points,
          sortOrder: idx,
        }));

      const removedTiers = (existing?.tiers ?? [])
        .filter((orig) => !orig.archivedAt && (
          !data.tiers.some((d) => d.serverId === orig.id) ||
          data.tiers.some((d) => d.serverId === orig.id && !d.name.trim())
        ))
        .map((orig) => ({
          id: orig.id,
          name: orig.name,
          points: orig.points,
          sortOrder: orig.sortOrder,
          shouldArchive: true,
        }));

      const result = await api.put<Chore>(`/api/admin/chores/${id}`, {
        name: data.name.trim(),
        requiresApproval: data.requiresApproval,
        sortOrder: data.sortOrder,
        tiers: [...activeTiers, ...removedTiers],
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "chores"] });
      navigate("/admin/chores");
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    mutation.mutate(form);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  }

  function addTier() {
    setForm((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        { key: crypto.randomUUID(), name: "", points: 0, sortOrder: prev.tiers.length },
      ],
    }));
    if (errors.tiers) {
      setErrors((prev) => ({ ...prev, tiers: undefined }));
    }
  }

  function removeTier(key: string) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((tier) => tier.key !== key),
    }));
  }

  function updateTierName(key: string, name: string) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier) =>
        tier.key === key ? { ...tier, name } : tier,
      ),
    }));
    if (errors.tiers) {
      setErrors((prev) => ({ ...prev, tiers: undefined }));
    }
  }

  function updateTierPoints(key: string, points: number) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier) =>
        tier.key === key ? { ...tier, points } : tier,
      ),
    }));
  }

  function moveTier(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    setForm((prev) => {
      const next = [...prev.tiers];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return { ...prev, tiers: next };
    });
  }

  if (isEditing && isLoadingExisting) {
    return (
      <div>
        <div aria-live="polite" className="sr-only">Loading chore...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-muted)]" />
          <div className="h-64 rounded-2xl bg-[var(--color-surface-muted)]" />
        </div>
      </div>
    );
  }

  if (isEditing && loadError) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card" aria-live="assertive">
        <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
          Could not load chore.
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          It may have been deleted or the connection was lost.
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/chores")}
          className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          Back to Chores
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        {isEditing ? "Edit Chore" : "New Chore"}
      </h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        <div className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card">
          <fieldset>
            <legend className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">
              Details
            </legend>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="chore-name"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Name
                </label>
                <input
                  id="chore-name"
                  type="text"
                  autoFocus
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  placeholder="e.g. Clean Kitchen"
                />
                {errors.name && (
                  <p id="name-error" className="mt-1 text-sm text-[var(--color-red-600)]" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="chore-sort-order"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Sort Order
                </label>
                <input
                  id="chore-sort-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => updateField("sortOrder", Number(e.target.value) || 0)}
                  className="mt-1 w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />
              </div>

              <label className="flex min-h-touch items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={form.requiresApproval}
                  onChange={(e) => updateField("requiresApproval", e.target.checked)}
                  className="h-5 w-5 rounded border-[var(--color-border)] text-[var(--color-amber-500)] focus:ring-[var(--color-amber-500)]"
                />
                Requires approval
              </label>
            </div>
          </fieldset>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">
              Tiers
            </h2>
            <button
              type="button"
              onClick={addTier}
              className="min-h-touch rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
            >
              + Add Tier
            </button>
          </div>

          {errors.tiers && (
            <p id="tiers-error" className="mt-2 text-sm text-[var(--color-red-600)]" role="alert">
              {errors.tiers}
            </p>
          )}

          <div className="mt-4 space-y-2" aria-describedby={errors.tiers ? "tiers-error" : undefined}>
            {form.tiers.map((tier, index) => (
              <div key={tier.key} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveTier(index, "up")}
                    disabled={index === 0}
                    aria-label={`Move tier ${index + 1} up`}
                    className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTier(index, "down")}
                    disabled={index === form.tiers.length - 1}
                    aria-label={`Move tier ${index + 1} down`}
                    className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <label className="sr-only" htmlFor={`tier-name-${tier.key}`}>
                  Tier {index + 1} name
                </label>
                <input
                  id={`tier-name-${tier.key}`}
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTierName(tier.key, e.target.value)}
                  placeholder={`Tier ${index + 1}`}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />

                <label className="sr-only" htmlFor={`tier-points-${tier.key}`}>
                  Tier {index + 1} points
                </label>
                <input
                  id={`tier-points-${tier.key}`}
                  type="number"
                  min={0}
                  value={tier.points}
                  onChange={(e) => updateTierPoints(tier.key, Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />

                <button
                  type="button"
                  onClick={() => removeTier(tier.key)}
                  disabled={form.tiers.length <= 1}
                  aria-label={`Remove tier ${index + 1}`}
                  className="min-h-touch rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-red-600)] disabled:opacity-30"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {mutation.error && (
          <div className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4" role="alert">
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              {(mutation.error as { message?: string })?.message ?? "Failed to save chore. Please try again."}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || !isOnline}
            className="min-h-touch rounded-xl bg-[var(--color-amber-500)] px-6 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
          >
            {mutation.isPending
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Chore"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/chores")}
            className="min-h-touch rounded-xl px-6 py-2 font-body font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

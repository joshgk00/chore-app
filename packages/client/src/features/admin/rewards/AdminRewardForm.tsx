import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import AssetPicker from "../assets/AssetPicker.js";
import type { Reward } from "@chore-app/shared";

interface FormState {
  name: string;
  pointsCost: number;
  sortOrder: number;
  imageAssetId: number | null;
  imageUrl: string | null;
}

interface FormErrors {
  name?: string;
  pointsCost?: string;
  sortOrder?: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  pointsCost: 0,
  sortOrder: 0,
  imageAssetId: null,
  imageUrl: null,
};

function useExistingReward(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "rewards", id],
    queryFn: async () => {
      const result = await api.get<Reward>(`/api/admin/rewards/${id}`);
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
  } else if (form.name.trim().length > 200) {
    errors.name = "Name must be 200 characters or fewer";
  }
  if (!Number.isInteger(form.pointsCost) || form.pointsCost < 0 || form.pointsCost > 10000) {
    errors.pointsCost = "Points cost must be a whole number between 0 and 10,000";
  }
  if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0 || form.sortOrder > 9999) {
    errors.sortOrder = "Sort order must be a whole number between 0 and 9,999";
  }
  return errors;
}

export default function AdminRewardForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOnline = useOnline();
  const { data: existing, isLoading: isLoadingExisting, error: loadError } = useExistingReward(id);

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasPopulated, setHasPopulated] = useState(false);

  useEffect(() => {
    if (existing && !hasPopulated) {
      setForm({
        name: existing.name,
        pointsCost: existing.pointsCost,
        sortOrder: existing.sortOrder,
        imageAssetId: existing.imageAssetId ?? null,
        imageUrl: existing.imageUrl ?? null,
      });
      setHasPopulated(true);
    }
  }, [existing, hasPopulated]);

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const result = await api.post<Reward>("/api/admin/rewards", {
        name: data.name.trim(),
        pointsCost: data.pointsCost,
        sortOrder: data.sortOrder,
        imageAssetId: data.imageAssetId,
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "rewards"] });
      navigate("/admin/rewards");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const result = await api.put<Reward>(`/api/admin/rewards/${id}`, {
        name: data.name.trim(),
        pointsCost: data.pointsCost,
        sortOrder: data.sortOrder,
        imageAssetId: data.imageAssetId,
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "rewards"] });
      navigate("/admin/rewards");
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
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
    if (key === "pointsCost" && errors.pointsCost) {
      setErrors((prev) => ({ ...prev, pointsCost: undefined }));
    }
    if (key === "sortOrder" && errors.sortOrder) {
      setErrors((prev) => ({ ...prev, sortOrder: undefined }));
    }
  }

  if (isEditing && isLoadingExisting) {
    return (
      <div>
        <div aria-live="polite" className="sr-only">Loading reward...</div>
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
          Could not load reward.
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          It may have been deleted or the connection was lost.
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/rewards")}
          className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          Back to Rewards
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        {isEditing ? "Edit Reward" : "New Reward"}
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
                  htmlFor="reward-name"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Name
                </label>
                <input
                  id="reward-name"
                  type="text"
                  autoFocus
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  placeholder="e.g. Extra Screen Time"
                />
                {errors.name && (
                  <p id="name-error" className="mt-1 text-sm text-[var(--color-red-600)]" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reward-points-cost"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Points Cost
                </label>
                <input
                  id="reward-points-cost"
                  type="number"
                  min={0}
                  value={form.pointsCost}
                  onChange={(e) => updateField("pointsCost", Number(e.target.value) || 0)}
                  aria-describedby={errors.pointsCost ? "points-cost-error" : undefined}
                  aria-invalid={!!errors.pointsCost}
                  className="mt-1 w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />
                {errors.pointsCost && (
                  <p id="points-cost-error" className="mt-1 text-sm text-[var(--color-red-600)]" role="alert">
                    {errors.pointsCost}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reward-sort-order"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Sort Order
                </label>
                <input
                  id="reward-sort-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => updateField("sortOrder", Number(e.target.value) || 0)}
                  aria-describedby={errors.sortOrder ? "sort-order-error" : undefined}
                  aria-invalid={!!errors.sortOrder}
                  className="mt-1 w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />
                {errors.sortOrder && (
                  <p id="sort-order-error" className="mt-1 text-sm text-[var(--color-red-600)]" role="alert">
                    {errors.sortOrder}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card">
          <AssetPicker
            value={form.imageAssetId}
            imageUrl={form.imageUrl ?? undefined}
            onChange={(assetId, imageUrl) => {
              setForm((prev) => ({ ...prev, imageAssetId: assetId, imageUrl }));
            }}
            label="Reward Image"
          />
        </div>

        {mutation.error && (
          <div className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4" role="alert">
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              {(mutation.error as { message?: string })?.message ?? "Failed to save reward. Please try again."}
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
                : "Create Reward"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/rewards")}
            className="min-h-touch rounded-xl px-6 py-2 font-body font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

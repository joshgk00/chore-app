import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import type { Routine, TimeSlot, CompletionRule } from "@chore-app/shared";

interface DraftItem {
  key: string;
  serverId?: number;
  label: string;
  sortOrder: number;
}

interface FormState {
  name: string;
  timeSlot: TimeSlot;
  completionRule: CompletionRule;
  points: number;
  requiresApproval: boolean;
  randomizeItems: boolean;
  sortOrder: number;
  items: DraftItem[];
}

interface FormErrors {
  name?: string;
  items?: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  timeSlot: "morning",
  completionRule: "once_per_day",
  points: 5,
  requiresApproval: false,
  randomizeItems: false,
  sortOrder: 0,
  items: [{ key: crypto.randomUUID(), label: "", sortOrder: 0 }],
};

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "bedtime", label: "Bedtime" },
  { value: "anytime", label: "Any Time" },
];

const COMPLETION_RULE_OPTIONS: { value: CompletionRule; label: string }[] = [
  { value: "once_per_day", label: "Once per day" },
  { value: "once_per_slot", label: "Once per slot" },
  { value: "unlimited", label: "Unlimited" },
];

function useExistingRoutine(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "routines", id],
    queryFn: async () => {
      const result = await api.get<Routine>(`/api/admin/routines/${id}`);
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
  const activeItems = form.items.filter((item) => item.label.trim());
  if (activeItems.length === 0) {
    errors.items = "At least one checklist item is required";
  }
  return errors;
}

export default function AdminRoutineForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOnline = useOnline();
  const { data: existing, isLoading: isLoadingExisting, error: loadError } = useExistingRoutine(id);

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasPopulated, setHasPopulated] = useState(false);

  useEffect(() => {
    if (existing && !hasPopulated) {
      setForm({
        name: existing.name,
        timeSlot: existing.timeSlot,
        completionRule: existing.completionRule,
        points: existing.points,
        requiresApproval: existing.requiresApproval,
        randomizeItems: existing.randomizeItems,
        sortOrder: existing.sortOrder,
        items: existing.items
          .filter((item) => !item.archivedAt)
          .map((item) => ({
            key: String(item.id),
            serverId: item.id,
            label: item.label,
            sortOrder: item.sortOrder,
          })),
      });
      setHasPopulated(true);
    }
  }, [existing, hasPopulated]);

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const result = await api.post<Routine>("/api/admin/routines", {
        name: data.name.trim(),
        timeSlot: data.timeSlot,
        completionRule: data.completionRule,
        points: data.points,
        requiresApproval: data.requiresApproval,
        randomizeItems: data.randomizeItems,
        sortOrder: data.sortOrder,
        items: data.items
          .filter((item) => item.label.trim())
          .map((item, idx) => ({ label: item.label.trim(), sortOrder: idx })),
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "routines"] });
      navigate("/admin/routines");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const result = await api.put<Routine>(`/api/admin/routines/${id}`, {
        name: data.name.trim(),
        timeSlot: data.timeSlot,
        completionRule: data.completionRule,
        points: data.points,
        requiresApproval: data.requiresApproval,
        randomizeItems: data.randomizeItems,
        sortOrder: data.sortOrder,
        items: data.items
          .filter((item) => item.label.trim())
          .map((item, idx) => ({
            id: item.serverId,
            label: item.label.trim(),
            sortOrder: idx,
          })),
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "routines"] });
      navigate("/admin/routines");
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

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { key: crypto.randomUUID(), label: "", sortOrder: prev.items.length },
      ],
    }));
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  }

  function removeItem(key: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.key !== key),
    }));
  }

  function updateItemLabel(key: string, label: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.key === key ? { ...item, label } : item,
      ),
    }));
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  }

  function moveItem(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    setForm((prev) => {
      const next = [...prev.items];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return { ...prev, items: next };
    });
  }

  if (isEditing && isLoadingExisting) {
    return (
      <div>
        <div aria-live="polite" className="sr-only">Loading routine...</div>
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
          Could not load routine.
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          It may have been deleted or the connection was lost.
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/routines")}
          className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
        >
          Back to Routines
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        {isEditing ? "Edit Routine" : "New Routine"}
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
                  htmlFor="routine-name"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Name
                </label>
                <input
                  id="routine-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  placeholder="e.g. Morning Routine"
                />
                {errors.name && (
                  <p id="name-error" className="mt-1 text-sm text-[var(--color-red-600)]" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
                <div>
                  <label
                    htmlFor="routine-timeslot"
                    className="block text-sm font-medium text-[var(--color-text-secondary)]"
                  >
                    Time Slot
                  </label>
                  <select
                    id="routine-timeslot"
                    value={form.timeSlot}
                    onChange={(e) => updateField("timeSlot", e.target.value as TimeSlot)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  >
                    {TIME_SLOT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="routine-rule"
                    className="block text-sm font-medium text-[var(--color-text-secondary)]"
                  >
                    Completion Rule
                  </label>
                  <select
                    id="routine-rule"
                    value={form.completionRule}
                    onChange={(e) => updateField("completionRule", e.target.value as CompletionRule)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  >
                    {COMPLETION_RULE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="routine-points"
                    className="block text-sm font-medium text-[var(--color-text-secondary)]"
                  >
                    Points
                  </label>
                  <input
                    id="routine-points"
                    type="number"
                    min={0}
                    value={form.points}
                    onChange={(e) => updateField("points", Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex min-h-touch items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.requiresApproval}
                    onChange={(e) => updateField("requiresApproval", e.target.checked)}
                    className="h-5 w-5 rounded border-[var(--color-border)] text-[var(--color-amber-500)] focus:ring-[var(--color-amber-500)]"
                  />
                  Requires approval
                </label>

                <label className="flex min-h-touch items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.randomizeItems}
                    onChange={(e) => updateField("randomizeItems", e.target.checked)}
                    className="h-5 w-5 rounded border-[var(--color-border)] text-[var(--color-amber-500)] focus:ring-[var(--color-amber-500)]"
                  />
                  Randomize items
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">
              Checklist Items
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="min-h-touch rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
            >
              + Add Item
            </button>
          </div>

          {errors.items && (
            <p id="items-error" className="mt-2 text-sm text-[var(--color-red-600)]" role="alert">
              {errors.items}
            </p>
          )}

          <div className="mt-4 space-y-2" aria-describedby={errors.items ? "items-error" : undefined}>
            {form.items.map((item, index) => (
              <div key={item.key} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                    aria-label={`Move item ${index + 1} up`}
                    className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, "down")}
                    disabled={index === form.items.length - 1}
                    aria-label={`Move item ${index + 1} down`}
                    className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <label className="sr-only" htmlFor={`item-${item.key}`}>
                  Checklist item {index + 1}
                </label>
                <input
                  id={`item-${item.key}`}
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItemLabel(item.key, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)]"
                />

                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remove item ${index + 1}`}
                  className="min-h-touch rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-red-600)]"
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
              {(mutation.error as { message?: string })?.message ?? "Failed to save routine. Please try again."}
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
                : "Create Routine"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/routines")}
            className="min-h-touch rounded-xl px-6 py-2 font-body font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

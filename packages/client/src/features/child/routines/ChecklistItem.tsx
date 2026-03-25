import type { ChecklistItem as ChecklistItemType } from "@chore-app/shared";

interface Props {
  item: ChecklistItemType;
  isChecked: boolean;
  onToggle: () => void;
}

export default function ChecklistItem({ item, isChecked, onToggle }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div
      role="checkbox"
      aria-checked={isChecked}
      aria-label={item.label}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={`flex min-h-touch cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber-500)] focus-visible:ring-offset-2 ${
        isChecked
          ? "border-[var(--color-emerald-500)] bg-[var(--color-emerald-50)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-faint)]"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
          isChecked
            ? "border-[var(--color-emerald-500)] bg-[var(--color-emerald-500)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)]"
        }`}
      >
        {isChecked && (
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.label}
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
      )}

      <span
        className={`text-lg font-medium transition-all duration-200 ${
          isChecked ? "text-[var(--color-emerald-700)] line-through" : "text-[var(--color-text)]"
        }`}
      >
        {item.label}
      </span>
    </div>
  );
}

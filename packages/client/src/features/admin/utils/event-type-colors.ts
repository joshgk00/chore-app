export type EventColorVariant = "dot" | "badge";

const DOT_COLORS: Record<string, string> = {
  routine_: "bg-[var(--color-sky-500)]",
  chore_: "bg-[var(--color-amber-500)]",
  reward_: "bg-[var(--color-amber-700)]",
};

const BADGE_COLORS: Record<string, string> = {
  routine_: "bg-[var(--color-sky-50)] text-[var(--color-sky-700)]",
  chore_: "bg-[var(--color-amber-50)] text-[var(--color-amber-700)]",
  reward_: "bg-[var(--color-amber-50)] text-[var(--color-amber-700)]",
};

const DEFAULT_DOT = "bg-[var(--color-text-muted)]";
const DEFAULT_BADGE =
  "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";

function matchPrefix(
  eventType: string,
  map: Record<string, string>,
  fallback: string,
): string {
  for (const [prefix, color] of Object.entries(map)) {
    if (eventType.startsWith(prefix)) return color;
  }
  return fallback;
}

export function eventTypeDotColor(eventType: string): string {
  return matchPrefix(eventType, DOT_COLORS, DEFAULT_DOT);
}

export function eventTypeBadgeColor(eventType: string): string {
  return matchPrefix(eventType, BADGE_COLORS, DEFAULT_BADGE);
}

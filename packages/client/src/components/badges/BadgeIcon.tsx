interface BadgeIconProps {
  badgeKey: string;
  isEarned: boolean;
  isNewlyEarned?: boolean;
}

const BADGE_DISPLAY: Record<string, { label: string; emoji: string }> = {
  first_step: { label: "First Step", emoji: "\u2B50" },
  on_a_roll: { label: "On a Roll", emoji: "\uD83D\uDD25" },
  week_warrior: { label: "Week Warrior", emoji: "\uD83D\uDCAA" },
  chore_champion: { label: "Chore Champion", emoji: "\uD83C\uDFC6" },
  big_spender: { label: "Big Spender", emoji: "\uD83D\uDCB0" },
  point_hoarder: { label: "Point Hoarder", emoji: "\uD83D\uDC8E" },
  helping_hand: { label: "Helping Hand", emoji: "\uD83E\uDD1D" },
  solo_act: { label: "Solo Act", emoji: "\uD83C\uDFAF" },
};

export default function BadgeIcon({ badgeKey, isEarned, isNewlyEarned }: BadgeIconProps) {
  const display = BADGE_DISPLAY[badgeKey] ?? { label: badgeKey, emoji: "\uD83C\uDFC5" };

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      role="img"
      aria-label={`${display.label}${isEarned ? " (earned)" : " (locked)"}`}
    >
      <div
        className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-2xl ${
          isEarned
            ? "bg-[var(--color-violet-50)] shadow-glow-violet"
            : "bg-[var(--color-surface-muted)]"
        } ${isNewlyEarned ? "animate-badge-unlock animate-badge-glow" : ""}`}
      >
        <span
          className={isEarned ? "" : "opacity-40 grayscale"}
          data-emoji
          aria-hidden="true"
        >
          {display.emoji}
        </span>
        {isEarned && (
          <span className="absolute inset-[-2px] rounded-[18px] border-2 border-[var(--color-violet-400)]" style={{ opacity: 0.5 }} aria-hidden="true" />
        )}
        {!isEarned && (
          <span className="absolute inset-[-2px] rounded-[18px] border-2 border-dashed border-[var(--color-border)]" aria-hidden="true" />
        )}
      </div>
      <span className={`text-center text-xs font-semibold leading-tight ${
        isEarned ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-faint)]"
      }`}>
        {display.label}
      </span>
    </div>
  );
}

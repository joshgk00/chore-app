interface BadgeIconProps {
  badgeKey: string;
  isEarned: boolean;
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

export default function BadgeIcon({ badgeKey, isEarned }: BadgeIconProps) {
  const display = BADGE_DISPLAY[badgeKey] ?? { label: badgeKey, emoji: "\uD83C\uDFC5" };

  return (
    <div
      className={`flex flex-col items-center gap-1 ${isEarned ? "" : "opacity-40 grayscale"}`}
      role="img"
      aria-label={`${display.label}${isEarned ? " (earned)" : " (locked)"}`}
    >
      <span className="text-3xl" aria-hidden="true">
        {display.emoji}
      </span>
      <span className="text-center text-xs font-medium text-gray-700">
        {display.label}
      </span>
    </div>
  );
}

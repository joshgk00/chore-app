import { BADGE_KEYS } from "@chore-app/shared";
import type { Badge } from "@chore-app/shared";
import BadgeIcon from "./BadgeIcon.js";

interface BadgeCollectionProps {
  earnedBadges: Badge[];
}

const ALL_BADGE_KEYS = Object.values(BADGE_KEYS);

export default function BadgeCollection({ earnedBadges }: BadgeCollectionProps) {
  const earnedKeySet = new Set(earnedBadges.map((b) => b.badgeKey));

  return (
    <div className="grid grid-cols-4 gap-4">
      {ALL_BADGE_KEYS.map((key) => (
        <BadgeIcon key={key} badgeKey={key} isEarned={earnedKeySet.has(key)} />
      ))}
    </div>
  );
}

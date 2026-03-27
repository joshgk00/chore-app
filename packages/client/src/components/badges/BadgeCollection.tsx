import { BADGE_KEYS } from "@chore-app/shared";
import type { Badge } from "@chore-app/shared";
import BadgeIcon from "./BadgeIcon.js";

interface BadgeCollectionProps {
  earnedBadges: Badge[];
  newlyEarnedKeys?: Set<string>;
}

export default function BadgeCollection({ earnedBadges, newlyEarnedKeys }: BadgeCollectionProps) {
  const earnedKeySet = new Set(earnedBadges.map((badge) => badge.badgeKey));

  return (
    <div
      className="grid grid-cols-4 gap-4"
      role="group"
      aria-label={`Badges: ${earnedBadges.length} of ${Object.keys(BADGE_KEYS).length} earned`}
    >
      {Object.values(BADGE_KEYS).map((key) => (
        <BadgeIcon
          key={key}
          badgeKey={key}
          isEarned={earnedKeySet.has(key)}
          isNewlyEarned={newlyEarnedKeys?.has(key)}
        />
      ))}
    </div>
  );
}

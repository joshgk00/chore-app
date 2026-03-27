import { useNavigate } from "react-router-dom";
import type { PointsBalance } from "@chore-app/shared";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber.js";

interface PointsBadgeProps {
  balance: PointsBalance;
}

export default function PointsBadge({ balance }: PointsBadgeProps) {
  const navigate = useNavigate();
  const displayed = useAnimatedNumber(balance.available);

  return (
    <button
      type="button"
      onClick={() => navigate("/rewards")}
      className="flex items-center gap-1.5 rounded-full border border-[var(--color-amber-100)] bg-[var(--color-amber-50)] px-3 py-1.5 font-display font-bold text-[var(--color-amber-700)] shadow-sm transition-all duration-150 active:scale-95"
      aria-label={`${balance.available} points available. View rewards`}
    >
      <span data-emoji aria-hidden="true">⭐</span>
      <span data-testid="points-badge-value">{displayed}</span>
    </button>
  );
}

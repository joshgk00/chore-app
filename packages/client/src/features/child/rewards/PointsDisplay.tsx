import type { PointsBalance } from "@chore-app/shared";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber.js";

interface PointsDisplayProps {
  balance: PointsBalance;
}

export default function PointsDisplay({ balance }: PointsDisplayProps) {
  const displayedAvailable = useAnimatedNumber(balance.available);
  const displayedTotal = useAnimatedNumber(balance.total);

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-glow-amber"
      style={{ background: `linear-gradient(135deg, var(--gradient-points-from), var(--gradient-points-to))` }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-6 h-32 w-32 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative text-center">
        <p className="text-sm font-medium text-white/90">Available Points</p>
        <p className="font-display text-5xl font-bold" data-testid="available-points">
          {displayedAvailable}
        </p>
      </div>
      <div className="relative mt-2 flex justify-center gap-6 text-sm text-white/90">
        <span>Total: {displayedTotal}</span>
        {balance.reserved > 0 && <span>Reserved: {balance.reserved}</span>}
      </div>
    </div>
  );
}

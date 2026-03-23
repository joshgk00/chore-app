import type { PointsBalance } from "@chore-app/shared";

interface PointsDisplayProps {
  balance: PointsBalance;
}

export default function PointsDisplay({ balance }: PointsDisplayProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 p-4 text-white shadow-md">
      <div className="text-center">
        <p className="text-sm font-medium text-white">Available Points</p>
        <p className="text-4xl font-bold" data-testid="available-points">
          {balance.available}
        </p>
      </div>
      <div className="mt-3 flex justify-center gap-6 text-sm text-white/80">
        <span>Total: {balance.total}</span>
        {balance.reserved > 0 && <span>Reserved: {balance.reserved}</span>}
      </div>
    </div>
  );
}

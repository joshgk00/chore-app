interface StatusPillProps {
  children: React.ReactNode;
  size?: "sm" | "md";
  hasBorder?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: "px-2.5 py-0.5 text-[11px] font-bold",
  md: "px-3 py-1 text-sm font-display font-bold",
} as const;

export default function StatusPill({
  children,
  size = "md",
  hasBorder = false,
  className = "",
}: StatusPillProps) {
  const borderClasses = hasBorder
    ? "border border-[var(--color-amber-100)] bg-[var(--color-amber-50)]"
    : "bg-[var(--color-amber-100)]";

  return (
    <span
      className={`rounded-full text-[var(--color-amber-700)] ${borderClasses} ${SIZE_CLASSES[size]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

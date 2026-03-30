import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: string;
  as?: "section" | "div";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-live"?: "polite" | "assertive" | "off";
  role?: string;
}

export default function Card({
  children,
  className = "",
  padding = "p-5",
  as: Tag = "div",
  ...rest
}: CardProps) {
  return (
    <Tag
      className={`rounded-2xl bg-[var(--color-surface)] shadow-card ${padding} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}

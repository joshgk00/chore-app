import type { MascotState } from "./mascotStates.js";

interface MascotProps {
  state: MascotState;
  size?: number;
  className?: string;
}

function Eyes({ state }: { state: MascotState }) {
  switch (state) {
    case "sleeping":
      return (
        <g aria-hidden="true">
          <path d="M30 44 Q35 48 40 44" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 44 Q65 48 70 44" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "celebrating":
      return (
        <g aria-hidden="true">
          <path d="M30 40 L33 44 L37 38 L40 44" fill="none" stroke="var(--color-amber-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M60 40 L63 44 L67 38 L70 44" fill="none" stroke="var(--color-amber-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "happy":
      return (
        <g aria-hidden="true">
          <path d="M30 44 Q35 38 40 44" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 44 Q65 38 70 44" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "waiting":
      return (
        <g aria-hidden="true">
          <circle cx="35" cy="42" r="3.5" fill="var(--color-text)" />
          <circle cx="65" cy="42" r="3.5" fill="var(--color-text)" />
          <circle cx="36" cy="41" r="1" fill="var(--color-surface)" />
          <circle cx="66" cy="41" r="1" fill="var(--color-surface)" />
        </g>
      );
    default:
      return (
        <g aria-hidden="true">
          <circle cx="35" cy="42" r="4" fill="var(--color-text)" />
          <circle cx="65" cy="42" r="4" fill="var(--color-text)" />
          <circle cx="36.5" cy="40.5" r="1.2" fill="var(--color-surface)" />
          <circle cx="66.5" cy="40.5" r="1.2" fill="var(--color-surface)" />
        </g>
      );
  }
}

function Mouth({ state }: { state: MascotState }) {
  switch (state) {
    case "sleeping":
      return (
        <ellipse cx="50" cy="60" rx="3" ry="2" fill="var(--color-text-muted)" aria-hidden="true" />
      );
    case "celebrating":
      return (
        <path d="M38 56 Q50 70 62 56" fill="var(--color-amber-600)" stroke="none" aria-hidden="true" />
      );
    case "happy":
      return (
        <path d="M38 57 Q50 67 62 57" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" />
      );
    case "encouraging":
      return (
        <path d="M42 58 Q50 63 58 58" fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" />
      );
    case "waiting":
      return (
        <circle cx="50" cy="60" r="4" fill="var(--color-text-muted)" aria-hidden="true" />
      );
    default:
      return (
        <path d="M40 57 Q50 64 60 57" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" />
      );
  }
}

function Accessories({ state }: { state: MascotState }) {
  switch (state) {
    case "sleeping":
      return (
        <g className="mascot-accessory" aria-hidden="true">
          <text x="74" y="30" fontSize="10" fontFamily="var(--font-display, Fredoka)" fontWeight="600" fill="var(--color-text-muted)">z</text>
          <text x="80" y="22" fontSize="8" fontFamily="var(--font-display, Fredoka)" fontWeight="600" fill="var(--color-text-faint)">z</text>
          <text x="85" y="16" fontSize="6" fontFamily="var(--font-display, Fredoka)" fontWeight="600" fill="var(--color-text-faint)">z</text>
        </g>
      );
    case "celebrating":
      return (
        <g className="mascot-accessory" aria-hidden="true">
          <circle cx="18" cy="20" r="2" fill="var(--color-amber-400)" />
          <circle cx="82" cy="18" r="1.5" fill="var(--color-violet-400)" />
          <circle cx="76" cy="10" r="2" fill="var(--color-emerald-400)" />
          <circle cx="24" cy="12" r="1.5" fill="var(--color-sky-500)" />
          <circle cx="50" cy="8" r="1.8" fill="var(--color-amber-500)" />
        </g>
      );
    default:
      return null;
  }
}

function Cheeks({ state }: { state: MascotState }) {
  if (state === "sleeping" || state === "waiting") return null;

  return (
    <g aria-hidden="true">
      <ellipse cx="22" cy="54" rx="6" ry="4" fill="var(--color-amber-100)" opacity="0.6" />
      <ellipse cx="78" cy="54" rx="6" ry="4" fill="var(--color-amber-100)" opacity="0.6" />
    </g>
  );
}

const STATE_LABELS: Record<MascotState, string> = {
  greeting: "Mascot waving hello",
  happy: "Mascot feeling happy",
  celebrating: "Mascot celebrating",
  waiting: "Mascot waiting patiently",
  encouraging: "Mascot cheering you on",
  sleeping: "Mascot sleeping",
};

export default function Mascot({ state, size = 80, className = "" }: MascotProps) {
  return (
    <svg
      viewBox="0 0 100 80"
      width={size}
      height={size * 0.8}
      role="img"
      aria-label={STATE_LABELS[state]}
      className={`mascot mascot-${state} ${className}`.trim()}
      data-state={state}
    >
      <circle cx="50" cy="45" r="32" fill="var(--color-amber-100)" stroke="var(--color-amber-400)" strokeWidth="2" />

      <Cheeks state={state} />
      <Eyes state={state} />
      <Mouth state={state} />
      <Accessories state={state} />
    </svg>
  );
}

import { useState, useRef, useEffect, useId } from "react";

interface HelpTipProps {
  text: string;
  id?: string;
}

export default function HelpTip({ text, id }: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const tipId = id ?? generatedId;

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tipId : undefined}
        aria-label="Help"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs font-bold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-amber-500)] hover:text-[var(--color-amber-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber-500)] focus-visible:ring-offset-1"
      >
        ?
      </button>
      {isOpen && (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs leading-relaxed text-[var(--color-text-secondary)] shadow-elevated"
        >
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--color-border)] bg-[var(--color-surface)]" />
          {text}
        </div>
      )}
    </div>
  );
}

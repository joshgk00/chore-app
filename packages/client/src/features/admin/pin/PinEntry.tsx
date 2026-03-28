import { useState, useRef, useEffect, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";

function isValidReturnPath(path: string): boolean {
  return path.startsWith("/admin");
}

export default function PinEntry() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isOnline = useOnline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pinRef = useRef<HTMLInputElement>(null);
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    pinRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await api.post<{ valid: boolean }>("/api/auth/verify", { pin });

    setLoading(false);

    if (result.ok) {
      const destination = returnTo && isValidReturnPath(returnTo) ? returnTo : "/admin";
      navigate(destination, { replace: true });
    } else {
      if (result.error.code === "TOO_MANY_REQUESTS") {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError("Invalid PIN. Please try again.");
      }
      setPin("");
      pinRef.current?.focus();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] text-white"
          style={{ background: "linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))" }}
          aria-hidden="true"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold text-[var(--color-text)]">Admin Access</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Enter your PIN to manage chores</p>

        {returnTo && (
          <p className="mt-4 text-sm font-medium text-[var(--color-amber-700)]" role="status">
            Your session expired. Sign in to pick up where you left off.
          </p>
        )}

        {!isOnline && (
          <p className="mt-4 text-sm font-medium text-[var(--color-amber-700)]" role="status">
            PIN verification requires a connection.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="pin" className="sr-only">
              Enter PIN
            </label>
            <input
              ref={pinRef}
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              aria-describedby={error ? "pin-error" : undefined}
              aria-invalid={!!error}
              className="block w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-center text-2xl tracking-[8px] text-[var(--color-text)] placeholder:text-base placeholder:tracking-[4px] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none"
              minLength={6}
              required
              disabled={loading}
            />
          </div>
          {error && (
            <p id="pin-error" className="text-center text-sm text-[var(--color-red-600)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length < 6 || !isOnline}
            className="w-full rounded-xl font-display text-base font-semibold text-white shadow-glow-amber transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--color-amber-500), var(--color-amber-600))", padding: "14px" }}
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>

        <Link
          to="/today"
          className="mt-4 inline-block text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          &larr; Back to app
        </Link>
      </div>
    </main>
  );
}

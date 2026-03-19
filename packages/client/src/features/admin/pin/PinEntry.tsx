import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";

export default function PinEntry() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await api.post<{ valid: boolean }>("/api/auth/verify", { pin });

    setLoading(false);

    if (result.ok) {
      navigate("/admin", { replace: true });
    } else {
      if (result.error.code === "TOO_MANY_REQUESTS") {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError("Invalid PIN. Please try again.");
      }
      setPin("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Admin Access</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
              Enter PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-widest shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              minLength={6}
              required
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length < 6}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

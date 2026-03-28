import type { ApiSuccess, ApiError } from "@chore-app/shared";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError["error"] };

export type AuthErrorHandler = (url: string) => void;

export const REQUEST_TIMEOUT_MS = 10_000;

let onAuthError: AuthErrorHandler | null = null;

export function setOnAuthError(handler: AuthErrorHandler | null): void {
  onAuthError = handler;
}

function isAdminEndpoint(url: string): boolean {
  return url.startsWith("/api/admin/");
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    return { ok: false, error: { code: "NETWORK_ERROR", message: "Unable to reach the server" } };
  } finally {
    clearTimeout(timeoutId);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      error: { code: "PARSE_ERROR", message: "Received an invalid response from the server" },
    };
  }

  if (!res.ok) {
    const errorBody = body as ApiError;
    const error = errorBody.error || { code: "UNKNOWN", message: "An unexpected error occurred" };

    if (res.status === 401 && isAdminEndpoint(url) && onAuthError) {
      try {
        onAuthError(url);
      } catch {
        // Side-effect should not crash the API response flow
      }
    }

    return { ok: false, error };
  }

  const successBody = body as ApiSuccess<T>;
  return { ok: true, data: successBody.data };
}

export const api = {
  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

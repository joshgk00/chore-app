import type { ApiSuccess, ApiError } from "@chore-app/shared";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError["error"] };

export const REQUEST_TIMEOUT_MS = 10_000;

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
    return {
      ok: false,
      error: errorBody.error || { code: "UNKNOWN", message: "An unexpected error occurred" },
    };
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

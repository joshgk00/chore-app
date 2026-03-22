import type { ApiSuccess, ApiError } from "@chore-app/shared";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError["error"] };

const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  // Race fetch against a manual timeout — AbortSignal is not passed to fetch because
  // it is incompatible with MSW in the jsdom test environment.
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new DOMException("Request timed out", "AbortError"));
    }, REQUEST_TIMEOUT_MS);
  });

  let res: Response;
  try {
    res = await Promise.race([
      fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      }),
      timeoutPromise,
    ]);
  } catch {
    return { ok: false, error: { code: "NETWORK_ERROR", message: "Unable to reach the server" } };
  } finally {
    clearTimeout(timeoutId!);
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

  post: <T>(url: string, data?: unknown) =>
    request<T>(url, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: unknown) =>
    request<T>(url, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

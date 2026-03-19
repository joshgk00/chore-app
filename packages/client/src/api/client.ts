import type { ApiSuccess, ApiError } from "@chore-app/shared";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError["error"] };

async function request<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await res.json();

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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import { useBackupExport } from "../../../../src/features/admin/hooks/useBackupExport.js";

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

describe("useBackupExport", () => {
  it("returns initial state with no export in progress", () => {
    const { result } = renderHook(() => useBackupExport());

    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportError).toBeNull();
    expect(result.current.isExportSuccess).toBe(false);
    expect(result.current.handleExport).toBeTypeOf("function");
  });

  it("downloads backup file on successful export", async () => {
    server.use(
      http.post("/api/admin/export", () => {
        return new HttpResponse(new Blob(["fake-zip"]), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="chore-app-2026.zip"',
          },
        });
      }),
    );

    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.isExportSuccess).toBe(true);
    expect(result.current.exportError).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("uses fallback filename when Content-Disposition is missing", async () => {
    const clickedDownloads: string[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {
          clickedDownloads.push((el as HTMLAnchorElement).download);
        });
      }
      return el;
    });

    server.use(
      http.post("/api/admin/export", () => {
        return new HttpResponse(new Blob(["fake-zip"]), {
          headers: { "Content-Type": "application/zip" },
        });
      }),
    );

    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(clickedDownloads[0]).toBe("chore-app-backup.zip");

    vi.restoreAllMocks();
  });

  it("sets error state on export failure", async () => {
    server.use(
      http.post("/api/admin/export", () => {
        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.isExportSuccess).toBe(false);
    expect(result.current.exportError).toBe(
      "Failed to export backup. Please try again.",
    );
  });

  it("clears previous error and success on new export attempt", async () => {
    server.use(
      http.post("/api/admin/export", () => {
        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "fail" } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.exportError).toBeTruthy();

    server.use(
      http.post("/api/admin/export", () => {
        return new HttpResponse(new Blob(["fake-zip"]), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="backup.zip"',
          },
        });
      }),
    );

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.exportError).toBeNull();
    expect(result.current.isExportSuccess).toBe(true);
  });

  it("sets isExporting during the request", async () => {
    let resolveRequest: (() => void) | undefined;

    server.use(
      http.post("/api/admin/export", async () => {
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });
        return new HttpResponse(new Blob(["fake-zip"]), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="backup.zip"',
          },
        });
      }),
    );

    const { result } = renderHook(() => useBackupExport());

    let exportPromise: Promise<void>;
    act(() => {
      exportPromise = result.current.handleExport();
    });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(true);
    });

    await act(async () => {
      resolveRequest!();
      await exportPromise!;
    });

    expect(result.current.isExporting).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import BackupSettings from "../../../../src/features/admin/settings/BackupSettings.js";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BackupSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BackupSettings", () => {
  it("renders export button and restore file input", () => {
    renderComponent();

    expect(
      screen.getByRole("button", { name: /export backup/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/select backup file to restore/i),
    ).toBeInTheDocument();
  });

  it("shows 'Exporting...' while export is in progress", async () => {
    server.use(
      http.post("/api/admin/export", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return new HttpResponse(new Blob(["fake-zip"]), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="backup.zip"',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: /export backup/i }));

    expect(screen.getByText("Exporting...")).toBeInTheDocument();
  });

  it("shows 'Backup downloaded' on export success", async () => {
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

    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: /export backup/i }));

    await waitFor(() => {
      expect(screen.getByText("Backup downloaded")).toBeInTheDocument();
    });
  });

  it("shows error message on export failure", async () => {
    server.use(
      http.post("/api/admin/export", () => {
        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        );
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: /export backup/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to export backup. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows error when selecting a non-zip file", async () => {
    renderComponent();

    const file = new File(["not-a-zip"], "data.json", {
      type: "application/json",
    });
    const input = document.getElementById(
      "restore-file-input",
    ) as HTMLInputElement;

    // fireEvent bypasses the accept filter that userEvent respects
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText("Please select a .zip backup file."),
      ).toBeInTheDocument();
    });
  });

  it("shows confirmation dialog when selecting a zip file", async () => {
    const user = userEvent.setup();
    renderComponent();

    const file = new File(["fake-zip"], "backup.zip", {
      type: "application/zip",
    });
    const input = document.getElementById(
      "restore-file-input",
    ) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });
  });

  it("dismisses confirmation dialog on cancel", async () => {
    const user = userEvent.setup();
    renderComponent();

    const file = new File(["fake-zip"], "backup.zip", {
      type: "application/zip",
    });
    const input = document.getElementById(
      "restore-file-input",
    ) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
    });
  });

  it("calls restore API and redirects on successful restore", async () => {
    server.use(
      http.post("/api/admin/restore", () => {
        return HttpResponse.json({ data: { restored: true } });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    const file = new File(["fake-zip"], "backup.zip", {
      type: "application/zip",
    });
    const input = document.getElementById(
      "restore-file-input",
    ) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /restore now/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/pin");
    });
  });

  it("shows error message on restore API failure", async () => {
    server.use(
      http.post("/api/admin/restore", () => {
        return HttpResponse.json(
          { error: { message: "Corrupt backup file" } },
          { status: 400 },
        );
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    const file = new File(["fake-zip"], "backup.zip", {
      type: "application/zip",
    });
    const input = document.getElementById(
      "restore-file-input",
    ) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /restore now/i }));

    await waitFor(() => {
      expect(screen.getByText("Corrupt backup file")).toBeInTheDocument();
    });
  });
});

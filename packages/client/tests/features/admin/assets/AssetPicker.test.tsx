import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AssetPicker from "../../../../src/features/admin/assets/AssetPicker.js";

const mockAssets = [
  {
    id: 1,
    source: "upload",
    storedFilename: "abc.webp",
    url: "/assets/abc.webp",
    status: "ready",
    reusable: false,
    originalFilename: "photo.jpg",
    mimeType: "image/webp",
    sizeBytes: 1024,
    width: 100,
    height: 100,
    prompt: null,
    model: null,
    createdAt: "2026-01-01",
    archivedAt: null,
  },
  {
    id: 2,
    source: "ai_generated",
    storedFilename: "def.webp",
    url: "/assets/def.webp",
    status: "ready",
    reusable: false,
    originalFilename: null,
    mimeType: "image/webp",
    sizeBytes: 2048,
    width: 200,
    height: 200,
    prompt: "A cat",
    model: "test",
    createdAt: "2026-01-02",
    archivedAt: null,
  },
];

function renderAssetPicker(props: Partial<React.ComponentProps<typeof AssetPicker>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const defaultProps = {
    value: null,
    onChange: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AssetPicker {...defaultProps} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    onChange: defaultProps.onChange,
  };
}

function getGenerateSubmitButton(): HTMLElement {
  const buttons = screen.getAllByRole("button", { name: "Generate" });
  return buttons[buttons.length - 1];
}

describe("AssetPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders placeholder when no value is set", () => {
    renderAssetPicker();

    expect(screen.getByText("No image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    renderAssetPicker({ label: "Routine Image" });

    expect(screen.getByText("Routine Image")).toBeInTheDocument();
  });

  it("shows image thumbnail when value is set", () => {
    renderAssetPicker({ value: 1, imageUrl: "/assets/abc.webp", label: "Test Image" });

    const img = screen.getByRole("img", { name: "Image for Test Image" });
    expect(img).toHaveAttribute("src", "/assets/abc.webp");
    expect(screen.getByRole("button", { name: "Remove image" })).toBeInTheDocument();
    expect(screen.queryByText("No image")).not.toBeInTheDocument();
  });

  it("calls onChange with null when clear button is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAssetPicker({ value: 1, imageUrl: "/assets/abc.webp" });

    await user.click(screen.getByRole("button", { name: "Remove image" }));

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it("opens asset library when Browse is clicked", async () => {
    server.use(
      http.get("/api/admin/assets", () =>
        HttpResponse.json({ data: mockAssets }),
      ),
    );

    const user = userEvent.setup();
    renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(screen.getByText("Asset Library")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("listbox", { name: "Available assets" })).toBeInTheDocument();
    });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("selects an asset from the library and calls onChange", async () => {
    server.use(
      http.get("/api/admin/assets", () =>
        HttpResponse.json({ data: mockAssets }),
      ),
    );

    const user = userEvent.setup();
    const { onChange } = renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    await user.click(screen.getAllByRole("option")[0]);

    expect(onChange).toHaveBeenCalledWith(1, "/assets/abc.webp");
  });

  it("closes the asset library when close button is clicked", async () => {
    server.use(
      http.get("/api/admin/assets", () =>
        HttpResponse.json({ data: mockAssets }),
      ),
    );

    const user = userEvent.setup();
    renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Browse" }));
    expect(screen.getByText("Asset Library")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close asset library" }));
    expect(screen.queryByText("Asset Library")).not.toBeInTheDocument();
  });

  it("shows empty message when no assets are available", async () => {
    server.use(
      http.get("/api/admin/assets", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    const user = userEvent.setup();
    renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByText("No assets available.")).toBeInTheDocument();
    });
  });

  it("triggers file input when Upload is clicked", async () => {
    const user = userEvent.setup();
    renderAssetPicker();

    const fileInput = screen.getByLabelText("Upload image file");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("uploads a file and calls onChange on success", async () => {
    server.use(
      http.post("/api/admin/assets/upload", () =>
        HttpResponse.json({
          data: mockAssets[0],
        }),
      ),
    );

    const user = userEvent.setup();
    const { onChange } = renderAssetPicker();

    const file = new File(["test-image"], "test.png", { type: "image/png" });
    const fileInput = screen.getByLabelText("Upload image file");

    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(1, "/assets/abc.webp");
    });
  });

  it("shows error when upload fails", async () => {
    server.use(
      http.post("/api/admin/assets/upload", () =>
        HttpResponse.json(
          { error: { message: "File too large" } },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderAssetPicker();

    const file = new File(["test-image"], "test.png", { type: "image/png" });
    const fileInput = screen.getByLabelText("Upload image file");

    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("File too large");
    });
  });

  it("opens generate panel and generates an image", async () => {
    server.use(
      http.post("/api/admin/assets/generate", () =>
        HttpResponse.json({
          data: mockAssets[1],
        }),
      ),
    );

    const user = userEvent.setup();
    const { onChange } = renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByText("Generate Image")).toBeInTheDocument();

    const promptInput = screen.getByLabelText("Image description");
    await user.type(promptInput, "A friendly cat");

    await user.click(getGenerateSubmitButton());

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(2, "/assets/def.webp");
    });
  });

  it("disables generate button when prompt is empty", async () => {
    const user = userEvent.setup();
    renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Generate" }));

    expect(getGenerateSubmitButton()).toBeDisabled();
  });

  it("shows loading state in asset library", async () => {
    server.use(
      http.get("/api/admin/assets", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ data: mockAssets });
      }),
    );

    const user = userEvent.setup();
    renderAssetPicker();

    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(screen.getByText("Loading assets...")).toBeInTheDocument();
  });
});

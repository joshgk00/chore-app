import { useState, useRef, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";

interface Asset {
  id: number;
  source: string;
  storedFilename: string;
  url: string;
  status: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  prompt: string | null;
  model: string | null;
}

export interface AssetPickerProps {
  value: number | null;
  imageUrl?: string;
  onChange: (assetId: number | null, imageUrl: string | null) => void;
  label?: string;
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const UPLOAD_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 45_000;

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error?.message || fallback;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

async function uploadAsset(file: File): Promise<Asset> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch("/api/admin/assets/upload", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Upload failed"));
    }

    const body = await res.json();
    return body.data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upload timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateAsset(prompt: string): Promise<Asset> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    const res = await fetch("/api/admin/assets/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Generation failed"));
    }

    const body = await res.json();
    return body.data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Image generation timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

type PickerMode = "idle" | "browse" | "generate";

export default function AssetPicker({ value, imageUrl, onChange, label }: AssetPickerProps) {
  const [mode, setMode] = useState<PickerMode>("idle");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptId = useId();

  const { data: assets, isLoading: isLoadingAssets } = useQuery({
    queryKey: ["admin", "assets", { status: "active" }],
    queryFn: async () => {
      const result = await api.get<Asset[]>("/api/admin/assets?status=active");
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: mode === "browse",
  });

  function handleClear() {
    onChange(null, null);
    setError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const asset = await uploadAsset(file);
      onChange(asset.id, asset.url);
      setMode("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleGenerate() {
    const trimmed = generatePrompt.trim();
    if (!trimmed) return;

    setIsGenerating(true);
    setError(null);
    try {
      const asset = await generateAsset(trimmed);
      onChange(asset.id, asset.url);
      setGeneratePrompt("");
      setMode("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSelectAsset(asset: Asset) {
    onChange(asset.id, asset.url);
    setMode("idle");
    setError(null);
  }

  const hasImage = value !== null && imageUrl;

  return (
    <div>
      {label && (
        <span className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}

      {hasImage ? (
        <div className="relative inline-block">
          <img
            src={imageUrl}
            alt={label ? `Image for ${label}` : "Selected asset"}
            className="h-20 w-20 rounded-2xl border border-[var(--color-border)] object-cover"
          />
          <button
            type="button"
            onClick={handleClear}
            aria-label="Remove image"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-red-600)] text-white shadow-card transition-colors hover:opacity-80"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]">
            <span className="text-xs text-[var(--color-text-muted)]">No image</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "browse" ? "idle" : "browse")}
              className="min-h-touch rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="min-h-touch rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "generate" ? "idle" : "generate")}
              className="min-h-touch rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
            >
              Generate
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload image file"
      />

      {mode === "browse" && (
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-sm font-semibold text-[var(--color-text-secondary)]">
              Asset Library
            </h4>
            <button
              type="button"
              onClick={() => setMode("idle")}
              aria-label="Close asset library"
              className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoadingAssets ? (
            <div aria-live="polite" role="status" className="mt-3">
              <p className="sr-only">Loading assets...</p>
              <div className="grid grid-cols-4 gap-2 tablet:grid-cols-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
                ))}
              </div>
            </div>
          ) : assets && assets.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-2 tablet:grid-cols-6" role="listbox" aria-label="Available assets">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  role="option"
                  aria-selected={asset.id === value}
                  onClick={() => handleSelectAsset(asset)}
                  className={`overflow-hidden rounded-xl border-2 transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber-500)] ${
                    asset.id === value
                      ? "border-[var(--color-amber-500)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <img
                    src={asset.url}
                    alt={asset.originalFilename ?? `Asset ${asset.id}`}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-center text-sm text-[var(--color-text-muted)]">
              No assets available.
            </p>
          )}
        </div>
      )}

      {mode === "generate" && (
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-sm font-semibold text-[var(--color-text-secondary)]">
              Generate Image
            </h4>
            <button
              type="button"
              onClick={() => setMode("idle")}
              aria-label="Close generate panel"
              className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor={promptId}>
              Image description
            </label>
            <input
              id={promptId}
              type="text"
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="Describe the image..."
              disabled={isGenerating}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-body text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-amber-500)] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !generatePrompt.trim()}
              className="min-h-touch rounded-lg bg-[var(--color-amber-500)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-[var(--color-red-600)]" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      {(isUploading || isGenerating) && (
        <div aria-live="polite" className="sr-only">
          {isUploading ? "Uploading image..." : "Generating image..."}
        </div>
      )}
    </div>
  );
}

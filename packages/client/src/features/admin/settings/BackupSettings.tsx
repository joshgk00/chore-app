import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { notifyAdminAuthError } from "../../../api/client.js";

export default function BackupSettings() {
  const isOnline = useOnline();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreConfirmVisible, setIsRestoreConfirmVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    const exportUrl = "/api/admin/export";
    try {
      const response = await fetch(exportUrl, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        notifyAdminAuthError(exportUrl, response.status);
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "chore-app-backup.zip";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
    } catch {
      setExportError("Failed to export backup. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setRestoreError("Please select a .zip backup file.");
      return;
    }

    setSelectedFile(file);
    setRestoreError(null);
    setIsRestoreConfirmVisible(true);
  }

  async function handleRestore() {
    if (!selectedFile) return;

    setIsRestoring(true);
    setRestoreError(null);

    const url = "/api/admin/restore";
    try {
      const formData = new FormData();
      formData.append("backup", selectedFile);

      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!response.ok) {
        notifyAdminAuthError(url, response.status);
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Restore failed");
      }

      queryClient.clear();
      navigate("/admin/pin");
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : "Failed to restore backup. Please try again.",
      );
    } finally {
      setIsRestoring(false);
      setIsRestoreConfirmVisible(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleCancelRestore() {
    setIsRestoreConfirmVisible(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section
      className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card"
      aria-label="Backup and restore"
    >
      <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
        Backup &amp; Restore
      </h2>

            <div className="mt-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Download a complete backup of your data, including the database and uploaded images.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={!isOnline || isExporting}
            className="min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
          >
            {isExporting ? "Exporting..." : "Export Backup"}
          </button>
          {exportSuccess && (
            <p className="text-sm text-[var(--color-emerald-600)]" role="status">
              Backup downloaded
            </p>
          )}
        </div>
        {exportError && (
          <p className="mt-2 text-sm text-[var(--color-red-600)]" role="alert">
            {exportError}
          </p>
        )}
      </div>

            <div className="mt-6 border-t border-[var(--color-border)] pt-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Restore from a previous backup. This will replace all current data.
        </p>
        <div className="mt-3">
          {!isRestoreConfirmVisible ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={!isOnline || isRestoring}
                className="hidden"
                id="restore-file-input"
                aria-label="Select backup file to restore"
              />
              <label
                htmlFor="restore-file-input"
                className={`inline-flex min-h-touch cursor-pointer items-center rounded-xl border-2 border-dashed border-[var(--color-border)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-amber-500)] hover:text-[var(--color-amber-500)] ${
                  !isOnline ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Choose Backup File
              </label>
            </>
          ) : (
            <div
              className="rounded-xl border border-[var(--color-amber-500)] bg-[var(--color-surface-muted)] p-4"
              role="alertdialog"
              aria-label="Confirm restore"
            >
              <p className="font-display font-bold text-[var(--color-text)]">
                Are you sure?
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                This will replace all data with the backup. You will need to log in again.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={!isOnline || isRestoring}
                  className="min-h-touch rounded-xl bg-[var(--color-red-600)] px-5 py-2 font-display font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {isRestoring ? "Restoring..." : "Restore Now"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelRestore}
                  disabled={isRestoring}
                  className="min-h-touch rounded-xl border border-[var(--color-border)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {restoreError && (
          <p className="mt-2 text-sm text-[var(--color-red-600)]" role="alert">
            {restoreError}
          </p>
        )}
      </div>
    </section>
  );
}

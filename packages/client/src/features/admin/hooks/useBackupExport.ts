import { useState } from "react";
import { notifyAdminAuthError } from "../../../api/client.js";

const EXPORT_URL = "/api/admin/export";

export function useBackupExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportSuccess, setIsExportSuccess] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    setIsExportSuccess(false);

    try {
      const response = await fetch(EXPORT_URL, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        notifyAdminAuthError(EXPORT_URL, response.status);
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

      setIsExportSuccess(true);
    } catch {
      setExportError("Failed to export backup. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportError, isExportSuccess, handleExport };
}

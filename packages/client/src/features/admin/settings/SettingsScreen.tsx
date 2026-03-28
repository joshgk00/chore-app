import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PIN_MIN_LENGTH } from "@chore-app/shared";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys } from "../../../lib/query-keys.js";
import HelpTip from "../../../components/HelpTip.js";
import BackupSettings from "./BackupSettings.js";
import NotificationSettings from "./NotificationSettings.js";

interface SettingsResponse {
  [key: string]: string;
}

interface PinChangePayload {
  currentPin: string;
  newPin: string;
}

const TIME_FORMAT = /^\d{2}:\d{2}$/;

function isValidTime(value: string): boolean {
  if (!TIME_FORMAT.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">
        Loading settings...
      </div>
      <div className="animate-pulse space-y-6">
        <div className="h-64 rounded-2xl bg-[var(--color-surface-muted)]" />
        <div className="h-40 rounded-2xl bg-[var(--color-surface-muted)]" />
        <div className="h-48 rounded-2xl bg-[var(--color-surface-muted)]" />
      </div>
    </div>
  );
}

export default function SettingsScreen() {
  const isOnline = useOnline();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: async () => {
      const result = await api.get<SettingsResponse>("/api/admin/settings");
      if (!result.ok) throw result.error;
      return result.data;
    },
  });

  const [morningStart, setMorningStart] = useState("");
  const [morningEnd, setMorningEnd] = useState("");
  const [afternoonStart, setAfternoonStart] = useState("");
  const [afternoonEnd, setAfternoonEnd] = useState("");
  const [bedtimeStart, setBedtimeStart] = useState("");
  const [bedtimeEnd, setBedtimeEnd] = useState("");
  const [timeSlotErrors, setTimeSlotErrors] = useState<Record<string, string>>({});
  const [timeSlotSuccess, setTimeSlotSuccess] = useState(false);

  const [timezone, setTimezone] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [generalErrors, setGeneralErrors] = useState<Record<string, string>>({});
  const [generalSuccess, setGeneralSuccess] = useState(false);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (query.data && !isInitialized) {
      setMorningStart(query.data.morning_start ?? "");
      setMorningEnd(query.data.morning_end ?? "");
      setAfternoonStart(query.data.afternoon_start ?? "");
      setAfternoonEnd(query.data.afternoon_end ?? "");
      setBedtimeStart(query.data.bedtime_start ?? "");
      setBedtimeEnd(query.data.bedtime_end ?? "");
      setTimezone(query.data.timezone ?? "");
      setRetentionDays(query.data.activity_retention_days ?? "");
      setIsInitialized(true);
    }
  }, [query.data, isInitialized]);

  const saveSettingsMutationOptions = {
    mutationFn: async (settings: Record<string, string>) => {
      const result = await api.put<SettingsResponse>("/api/admin/settings", settings);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() });
    },
  };

  const timeSlotMutation = useMutation(saveSettingsMutationOptions);
  const generalMutation = useMutation(saveSettingsMutationOptions);

  const pinMutation = useMutation({
    mutationFn: async (payload: PinChangePayload) => {
      const result = await api.put<{ pinChanged: boolean }>("/api/admin/settings/pin", payload);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });

  function validateTimeSlots(): boolean {
    const errors: Record<string, string> = {};
    const fields = [
      { key: "morningStart", value: morningStart, label: "Morning start" },
      { key: "morningEnd", value: morningEnd, label: "Morning end" },
      { key: "afternoonStart", value: afternoonStart, label: "Afternoon start" },
      { key: "afternoonEnd", value: afternoonEnd, label: "Afternoon end" },
      { key: "bedtimeStart", value: bedtimeStart, label: "Bedtime start" },
      { key: "bedtimeEnd", value: bedtimeEnd, label: "Bedtime end" },
    ];
    for (const field of fields) {
      if (!field.value.trim()) {
        errors[field.key] = `${field.label} is required`;
      } else if (!isValidTime(field.value)) {
        errors[field.key] = "Use HH:MM format (e.g. 08:00)";
      }
    }
    setTimeSlotErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleTimeSlotSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTimeSlots()) return;
    setTimeSlotSuccess(false);
    timeSlotMutation.mutate(
      {
        morning_start: morningStart,
        morning_end: morningEnd,
        afternoon_start: afternoonStart,
        afternoon_end: afternoonEnd,
        bedtime_start: bedtimeStart,
        bedtime_end: bedtimeEnd,
      },
      {
        onSuccess: () => setTimeSlotSuccess(true),
      },
    );
  }

  function validateGeneral(): boolean {
    const errors: Record<string, string> = {};
    if (!timezone.trim()) {
      errors.timezone = "Timezone is required";
    }
    const days = Number(retentionDays);
    if (!retentionDays || isNaN(days) || days < 1 || !Number.isInteger(days)) {
      errors.retentionDays = "Enter a positive whole number";
    }
    setGeneralErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleGeneralSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateGeneral()) return;
    setGeneralSuccess(false);
    generalMutation.mutate(
      {
        timezone,
        activity_retention_days: retentionDays,
      },
      {
        onSuccess: () => setGeneralSuccess(true),
      },
    );
  }

  function validatePin(): boolean {
    const errors: Record<string, string> = {};
    if (!currentPin) {
      errors.currentPin = "Current PIN is required";
    }
    if (!newPin) {
      errors.newPin = "New PIN is required";
    } else if (newPin.length < PIN_MIN_LENGTH) {
      errors.newPin = `PIN must be at least ${PIN_MIN_LENGTH} digits`;
    }
    if (!confirmPin) {
      errors.confirmPin = "Confirm your new PIN";
    } else if (newPin && confirmPin !== newPin) {
      errors.confirmPin = "PINs do not match";
    }
    setPinErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePin()) return;
    pinMutation.mutate(
      { currentPin, newPin },
      {
        onSuccess: () => {
          queryClient.clear();
          navigate("/admin/pin");
        },
      },
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Settings
      </h1>

      <div className="mt-6 space-y-6">
        {query.isLoading && <LoadingSkeleton />}

        <div aria-live="polite">
          {!isOnline && !query.data && !query.isLoading && (
            <div className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card">
              <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
                You're offline
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Settings require an internet connection to load.
              </p>
            </div>
          )}
        </div>

        {isOnline && query.error && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card"
            aria-live="assertive"
          >
            <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
              Could not load settings.
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
            >
              Try Again
            </button>
          </div>
        )}

        {!query.isLoading && !query.error && query.data && (
          <>
            <form
              onSubmit={handleTimeSlotSave}
              className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card"
              aria-label="Time slot settings"
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
                  Time Slots
                </h2>
                <HelpTip
                  id="help-time-slots"
                  text="Define when morning, afternoon, and bedtime start and end. Routines assigned to a time slot only show up during that window."
                />
              </div>
              <div className="mt-4 space-y-4">
                <TimeSlotRow
                  label="Morning"
                  startId="morning-start"
                  endId="morning-end"
                  startValue={morningStart}
                  endValue={morningEnd}
                  onStartChange={(v) => {
                    setMorningStart(v);
                    if (timeSlotErrors.morningStart) setTimeSlotErrors((prev) => ({ ...prev, morningStart: "" }));
                  }}
                  onEndChange={(v) => {
                    setMorningEnd(v);
                    if (timeSlotErrors.morningEnd) setTimeSlotErrors((prev) => ({ ...prev, morningEnd: "" }));
                  }}
                  startError={timeSlotErrors.morningStart}
                  endError={timeSlotErrors.morningEnd}
                />
                <TimeSlotRow
                  label="Afternoon"
                  startId="afternoon-start"
                  endId="afternoon-end"
                  startValue={afternoonStart}
                  endValue={afternoonEnd}
                  onStartChange={(v) => {
                    setAfternoonStart(v);
                    if (timeSlotErrors.afternoonStart) setTimeSlotErrors((prev) => ({ ...prev, afternoonStart: "" }));
                  }}
                  onEndChange={(v) => {
                    setAfternoonEnd(v);
                    if (timeSlotErrors.afternoonEnd) setTimeSlotErrors((prev) => ({ ...prev, afternoonEnd: "" }));
                  }}
                  startError={timeSlotErrors.afternoonStart}
                  endError={timeSlotErrors.afternoonEnd}
                />
                <TimeSlotRow
                  label="Bedtime"
                  startId="bedtime-start"
                  endId="bedtime-end"
                  startValue={bedtimeStart}
                  endValue={bedtimeEnd}
                  onStartChange={(v) => {
                    setBedtimeStart(v);
                    if (timeSlotErrors.bedtimeStart) setTimeSlotErrors((prev) => ({ ...prev, bedtimeStart: "" }));
                  }}
                  onEndChange={(v) => {
                    setBedtimeEnd(v);
                    if (timeSlotErrors.bedtimeEnd) setTimeSlotErrors((prev) => ({ ...prev, bedtimeEnd: "" }));
                  }}
                  startError={timeSlotErrors.bedtimeStart}
                  endError={timeSlotErrors.bedtimeEnd}
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!isOnline || timeSlotMutation.isPending}
                  className="min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
                >
                  {timeSlotMutation.isPending ? "Saving..." : "Save Time Slots"}
                </button>
                {timeSlotSuccess && (
                  <p className="text-sm text-[var(--color-emerald-600)]" role="status">
                    Saved
                  </p>
                )}
              </div>
              {timeSlotMutation.error && !timeSlotSuccess && (
                <div className="mt-3" role="alert">
                  <p className="text-sm text-[var(--color-red-600)]">
                    Failed to save time slots. Please try again.
                  </p>
                </div>
              )}
            </form>

            <form
              onSubmit={handleGeneralSave}
              className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card"
              aria-label="General settings"
            >
              <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
                General
              </h2>
              <div className="mt-4 space-y-4">
                <div>
                  <span className="flex items-center gap-1.5">
                    <label
                      htmlFor="settings-timezone"
                      className="text-xs font-semibold text-[var(--color-text-muted)]"
                    >
                      Timezone
                    </label>
                    <HelpTip
                      id="help-timezone"
                      text="Used to determine when each day starts and ends, and when time slots are active. Use IANA format like 'America/Chicago'."
                    />
                  </span>
                  <input
                    id="settings-timezone"
                    type="text"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      if (generalErrors.timezone) setGeneralErrors((prev) => ({ ...prev, timezone: "" }));
                    }}
                    aria-describedby={generalErrors.timezone ? "timezone-error" : undefined}
                    aria-invalid={!!generalErrors.timezone}
                    className="mt-1 w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                  />
                  {generalErrors.timezone && (
                    <p id="timezone-error" className="mt-1 text-xs text-[var(--color-red-600)]">
                      {generalErrors.timezone}
                    </p>
                  )}
                </div>
                <div>
                  <span className="flex items-center gap-1.5">
                    <label
                      htmlFor="settings-retention"
                      className="text-xs font-semibold text-[var(--color-text-muted)]"
                    >
                      Activity retention (days)
                    </label>
                    <HelpTip
                      id="help-retention"
                      text="How many days of activity history to keep. Older entries are automatically deleted. Doesn't affect the points ledger or balances."
                    />
                  </span>
                  <input
                    id="settings-retention"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={retentionDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setRetentionDays(e.target.value);
                      if (generalErrors.retentionDays) setGeneralErrors((prev) => ({ ...prev, retentionDays: "" }));
                    }}
                    aria-describedby={generalErrors.retentionDays ? "retention-error" : undefined}
                    aria-invalid={!!generalErrors.retentionDays}
                    className="mt-1 w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                  />
                  {generalErrors.retentionDays && (
                    <p id="retention-error" className="mt-1 text-xs text-[var(--color-red-600)]">
                      {generalErrors.retentionDays}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!isOnline || generalMutation.isPending}
                  className="min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-amber-600)] disabled:opacity-50"
                >
                  {generalMutation.isPending ? "Saving..." : "Save General"}
                </button>
                {generalSuccess && (
                  <p className="text-sm text-[var(--color-emerald-600)]" role="status">
                    Saved
                  </p>
                )}
              </div>
              {generalMutation.error && !generalSuccess && (
                <div className="mt-3" role="alert">
                  <p className="text-sm text-[var(--color-red-600)]">
                    Failed to save settings. Please try again.
                  </p>
                </div>
              )}
            </form>

            <form
              onSubmit={handlePinChange}
              className="rounded-2xl bg-[var(--color-surface)] p-6 shadow-card"
              aria-label="Change PIN"
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
                  Change PIN
                </h2>
                <HelpTip
                  id="help-change-pin"
                  text="The admin PIN protects access to these settings and the approval queue. Changing it will log you out."
                />
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="current-pin"
                    className="block text-xs font-semibold text-[var(--color-text-muted)]"
                  >
                    Current PIN
                  </label>
                  <input
                    id="current-pin"
                    type="password"
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => {
                      setCurrentPin(e.target.value);
                      if (pinErrors.currentPin) setPinErrors((prev) => ({ ...prev, currentPin: "" }));
                    }}
                    aria-describedby={pinErrors.currentPin ? "current-pin-error" : undefined}
                    aria-invalid={!!pinErrors.currentPin}
                    className="mt-1 w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                  />
                  {pinErrors.currentPin && (
                    <p id="current-pin-error" className="mt-1 text-xs text-[var(--color-red-600)]">
                      {pinErrors.currentPin}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="new-pin"
                    className="block text-xs font-semibold text-[var(--color-text-muted)]"
                  >
                    New PIN
                  </label>
                  <input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value);
                      if (pinErrors.newPin) setPinErrors((prev) => ({ ...prev, newPin: "" }));
                    }}
                    aria-describedby={pinErrors.newPin ? "new-pin-error" : undefined}
                    aria-invalid={!!pinErrors.newPin}
                    className="mt-1 w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                  />
                  {pinErrors.newPin && (
                    <p id="new-pin-error" className="mt-1 text-xs text-[var(--color-red-600)]">
                      {pinErrors.newPin}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="confirm-pin"
                    className="block text-xs font-semibold text-[var(--color-text-muted)]"
                  >
                    Confirm new PIN
                  </label>
                  <input
                    id="confirm-pin"
                    type="password"
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value);
                      if (pinErrors.confirmPin) setPinErrors((prev) => ({ ...prev, confirmPin: "" }));
                    }}
                    aria-describedby={pinErrors.confirmPin ? "confirm-pin-error" : undefined}
                    aria-invalid={!!pinErrors.confirmPin}
                    className="mt-1 w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                  />
                  {pinErrors.confirmPin && (
                    <p id="confirm-pin-error" className="mt-1 text-xs text-[var(--color-red-600)]">
                      {pinErrors.confirmPin}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={!isOnline || pinMutation.isPending}
                  className="min-h-touch rounded-xl bg-[var(--color-red-600)] px-5 py-2 font-display font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {pinMutation.isPending ? "Changing..." : "Change PIN"}
                </button>
              </div>
              {pinMutation.error && (
                <div className="mt-3" role="alert">
                  <p className="text-sm text-[var(--color-red-600)]">
                    Failed to change PIN. Please check your current PIN and try again.
                  </p>
                </div>
              )}
            </form>

            <NotificationSettings />
            <BackupSettings />
          </>
        )}
      </div>
    </div>
  );
}

interface TimeSlotRowProps {
  label: string;
  startId: string;
  endId: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startError?: string;
  endError?: string;
}

function TimeSlotRow({
  label,
  startId,
  endId,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startError,
  endError,
}: TimeSlotRowProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[var(--color-text-secondary)]">
        {label}
      </legend>
      <div className="mt-1 flex flex-wrap items-start gap-3">
        <div>
          <label
            htmlFor={startId}
            className="block text-xs font-semibold text-[var(--color-text-muted)]"
          >
            Start
          </label>
          <input
            id={startId}
            type="text"
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
            placeholder="HH:MM"
            aria-describedby={startError ? `${startId}-error` : undefined}
            aria-invalid={!!startError}
            className="mt-1 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
          />
          {startError && (
            <p id={`${startId}-error`} className="mt-1 text-xs text-[var(--color-red-600)]">
              {startError}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor={endId}
            className="block text-xs font-semibold text-[var(--color-text-muted)]"
          >
            End
          </label>
          <input
            id={endId}
            type="text"
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
            placeholder="HH:MM"
            aria-describedby={endError ? `${endId}-error` : undefined}
            aria-invalid={!!endError}
            className="mt-1 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
          />
          {endError && (
            <p id={`${endId}-error`} className="mt-1 text-xs text-[var(--color-red-600)]">
              {endError}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

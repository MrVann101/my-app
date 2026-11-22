"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBrowserTimezone } from "@/lib/date";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Stockholm",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [reminderTime, setReminderTime] = useState("19:00");
  const [timezone, setTimezone] = useState("UTC");
  const [browserTimezone, setBrowserTimezone] = useState("UTC");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const browserTz = getBrowserTimezone();
      if (active) setBrowserTimezone(browserTz);
      fetch("/api/notifications/preferences")
        .then((response) => response.json())
        .then((payload) => {
          if (!active) return;
          const value = payload.preferences;
          if (!value) {
            setTimezone(browserTz);
            return;
          }
          setEmailEnabled(Boolean(value.email_enabled));
          setFrequency(value.frequency === "weekly" ? "weekly" : value.frequency === "off" ? "off" : "daily");
          setReminderTime(String(value.reminder_time || "19:00").slice(0, 5));
          setTimezone(value.timezone || browserTz);
        })
        .catch(() => {
          if (active) setError("Unable to load notification preferences.");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const timezoneOptions = useMemo(() => {
    return Array.from(new Set([timezone, browserTimezone, ...COMMON_TIMEZONES].filter(Boolean)));
  }, [timezone, browserTimezone]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const effectiveFrequency = emailEnabled ? (frequency === "off" ? "daily" : frequency) : "off";
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled,
          frequency: effectiveFrequency,
          reminderTime,
          timezone,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save notification preferences.");
        return;
      }
      setMessage("Notification preferences saved.");
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="rounded-2xl bg-[var(--surface-muted)] p-5" onSubmit={(event) => void save(event)}>
      <p className="font-semibold text-[var(--foreground)]">Reminders</p>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Choose whether Bitewise may send reminders. You can turn them off at any time.
      </p>

      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium text-[var(--foreground)]">
        <input
          className="size-4 accent-[var(--leaf)]"
          checked={emailEnabled}
          onChange={(event) => {
            const checked = event.target.checked;
            setEmailEnabled(checked);
            if (checked && frequency === "off") {
              setFrequency("daily");
            }
          }}
          type="checkbox"
        />
        <span>Enable meal reminders</span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="notif-frequency">Frequency</label>
          <select
            id="notif-frequency"
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 disabled:opacity-50"
            disabled={!emailEnabled}
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="notif-time">Local time</label>
          <input
            id="notif-time"
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 disabled:opacity-50"
            disabled={!emailEnabled}
            type="time"
            value={reminderTime}
            onChange={(event) => setReminderTime(event.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="block text-sm font-medium" htmlFor="notif-timezone">Timezone</label>
            <button
              type="button"
              disabled={!emailEnabled}
              onClick={() => setTimezone(getBrowserTimezone())}
              className="text-xs font-semibold text-[var(--leaf)] hover:underline disabled:opacity-50"
            >
              Use current
            </button>
          </div>
          <select
            id="notif-timezone"
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 disabled:opacity-50"
            disabled={!emailEnabled}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        disabled={isSaving}
        className="active-press mt-5 min-h-11 rounded-xl bg-[var(--leaf)] px-5 text-sm font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
        type="submit"
      >
        {isSaving ? "Saving..." : "Save reminders"}
      </button>

      {error && <p className="mt-3 text-sm font-medium text-[var(--coral)]" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm font-medium text-[var(--leaf)]" role="status">{message}</p>}
    </form>
  );
}

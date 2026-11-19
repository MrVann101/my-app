"use client";

import { FormEvent, useEffect, useState } from "react";

export default function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [frequency, setFrequency] = useState("off");
  const [reminderTime, setReminderTime] = useState("19:00");
  const [timezone, setTimezone] = useState("UTC");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { fetch("/api/notifications/preferences").then((response) => response.json()).then((payload) => { const value = payload.preferences; if (!value) return; setEmailEnabled(value.email_enabled); setFrequency(value.frequency); setReminderTime(String(value.reminder_time).slice(0, 5)); setTimezone(value.timezone); }).catch(() => setError("Unable to load notification preferences.")); }, 0); return () => window.clearTimeout(timer); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailEnabled, frequency: emailEnabled ? frequency : "off", reminderTime, timezone }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message ?? "Unable to save notification preferences."); return; }
    setMessage("Notification preferences saved.");
  }

  return <form className="mt-6 rounded-2xl bg-[var(--surface-muted)] p-4" onSubmit={save}><p className="font-semibold">Reminders</p><p className="mt-1 text-sm text-[var(--ink-muted)]">Choose whether Bitewise may send reminders. You can turn them off at any time.</p><label className="mt-4 flex items-center gap-3 text-sm font-medium"><input checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} type="checkbox" /> Email reminders</label><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Frequency<select className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" disabled={!emailEnabled} value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label className="text-sm font-medium">Local time<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" disabled={!emailEnabled} type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label><label className="text-sm font-medium">Timezone<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" disabled={!emailEnabled} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label></div><button className="mt-4 h-11 rounded-xl bg-[var(--leaf)] px-4 text-sm font-semibold text-[var(--on-leaf)]" type="submit">Save reminders</button>{error && <p className="mt-3 text-sm text-[var(--coral)]" role="alert">{error}</p>}{message && <p className="mt-3 text-sm text-[var(--leaf)]" role="status">{message}</p>}</form>;
}

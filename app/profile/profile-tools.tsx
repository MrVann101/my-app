"use client";

import { FormEvent, useState } from "react";

function localToday() { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export default function ProfileTools() {
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [calories, setCalories] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, path: string, body: unknown, success: string) {
    event.preventDefault(); setError(null); setMessage(null);
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message ?? "Unable to save this check-in."); return; }
    setMessage(success);
  }

  return <div className="mt-6 grid gap-5 sm:grid-cols-2"><form className="rounded-2xl bg-[var(--surface-muted)] p-4" onSubmit={(event) => submit(event, "/api/weight", { logDate: localToday(), weightKg: Number(weight) }, "Weight check-in saved.")}><p className="font-semibold">Weight check-in</p><label className="mt-4 block text-sm font-medium">Weight (kg)<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" min="1" max="700" step="0.1" type="number" value={weight} onChange={(event) => setWeight(event.target.value)} required /></label><button className="mt-4 h-11 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white disabled:opacity-50" disabled={!weight} type="submit">Save weight</button></form><form className="rounded-2xl bg-[var(--surface-muted)] p-4" onSubmit={(event) => submit(event, "/api/exercise", { logDate: localToday(), activityName: activity, caloriesBurned: Number(calories) }, "Exercise logged.")}><p className="font-semibold">Exercise</p><label className="mt-4 block text-sm font-medium">Activity<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Example: 30-minute walk" required /></label><label className="mt-3 block text-sm font-medium">Calories burned<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" min="0" max="10000" type="number" value={calories} onChange={(event) => setCalories(event.target.value)} required /></label><button className="mt-4 h-11 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white disabled:opacity-50" disabled={!activity || !calories} type="submit">Log exercise</button></form>{error && <p className="text-sm text-[var(--coral)] sm:col-span-2" role="alert">{error}</p>}{message && <p className="text-sm text-[var(--leaf)] sm:col-span-2" role="status">{message}</p>}</div>;
}

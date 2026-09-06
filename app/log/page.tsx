import AppShell from "@/components/app-shell";
import LogFoodForm from "./log-food-form";
import PhotoFoodForm from "./photo-food-form";
import TextFoodForm from "./text-food-form";

export default function LogPage() {
  return <AppShell eyebrow="Food log" title="Add what you ate"><div className="space-y-5"><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Build your entry</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Choose a database food or add a custom label, then adjust the portion weight.</p><div className="mt-6"><LogFoodForm /></div></div><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Describe your meal</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Turn plain language into editable food items and weights.</p><div className="mt-6"><TextFoodForm /></div></div><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Or use a photo</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">AI estimates are editable and never save automatically.</p><div className="mt-6"><PhotoFoodForm /></div></div></div></AppShell>;
}

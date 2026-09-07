import AppShell from "@/components/app-shell";
import PlanBuilder from "./plan-builder";
import PublicPlans from "./public-plans";
import MyPlans from "./my-plans";

export default function MealPlansPage() {
  return <AppShell eyebrow="Meal plans" title="Plan ahead, lightly"><div className="space-y-5"><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Create a reusable template</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Creating or editing a plan never changes today&apos;s totals. Logging it is always a separate action.</p><div className="mt-6"><PlanBuilder /></div></div><MyPlans /><PublicPlans /></div></AppShell>;
}

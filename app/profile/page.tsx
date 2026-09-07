import AppShell from "@/components/app-shell";
import ProfileTools from "./profile-tools";
import Link from "next/link";
import AccountControls from "./account-controls";

export default function ProfilePage() {
  return <AppShell eyebrow="Profile" title="Your settings"><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Your profile will grow with you.</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Update body stats, review your targets, and manage account settings here.</p><Link className="mt-5 inline-block rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--leaf)]" href="/profile/progress">View progress</Link><ProfileTools /><AccountControls /><p className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--ink-muted)]">Bitewise provides estimates for tracking and is not medical or professional nutrition advice.</p></div></AppShell>;
}

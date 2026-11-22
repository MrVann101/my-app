import Link from "next/link";
import { IconChevronLeft } from "./icons";

export default function BackLink({
  href = "/profile",
  label = "Back to Settings",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <div>
      <Link
        href={href}
        className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-xs transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)]"
      >
        <IconChevronLeft className="size-4" />
        <span>{label}</span>
      </Link>
    </div>
  );
}

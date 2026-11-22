"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IconBitewiseLogo } from "./icons";

export default function AuthHeader({
  badge,
  rightAction,
  maxWidthClass = "max-w-md",
}: {
  badge?: string;
  rightAction?: ReactNode;
  maxWidthClass?: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 8);
    const timer = window.setTimeout(updateScroll, 0);
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", updateScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ${
        isScrolled
          ? "border-[var(--line)]/80 bg-[var(--surface)]/55 shadow-xs backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className={`mx-auto flex ${maxWidthClass} items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-3.5`}>
        <Link
          className="active-press inline-flex min-h-11 items-center gap-2.5 text-lg font-bold tracking-tight text-[var(--foreground)]"
          href="/login"
        >
          <IconBitewiseLogo className="size-9 shadow-2xs sm:size-10" />
          <span>bitewise</span>
        </Link>
        {rightAction ? (
          rightAction
        ) : badge ? (
          <span className="rounded-full border border-[var(--line)] bg-[var(--surface)]/85 px-3 py-1 text-xs font-bold text-[var(--leaf-ink)] shadow-2xs backdrop-blur-md">
            {badge}
          </span>
        ) : null}
      </div>
    </header>
  );
}

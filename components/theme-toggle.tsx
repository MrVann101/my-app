"use client";

import { useSyncExternalStore } from "react";
import { IconSun, IconMoon } from "./icons";

type Theme = "dark" | "light";

const themeChangeEvent = "bitewise-theme-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(themeChangeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getTheme(): Theme {
  try {
    const theme = window.localStorage.getItem("bitewise-theme");
    return theme === "light" || theme === "dark" ? theme : "dark";
  } catch {
    return "dark";
  }
}

function getServerTheme(): Theme {
  return "dark";
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#13110e" : "#faf7f2");
    try {
      window.localStorage.setItem("bitewise-theme", next);
    } catch {}
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  return (
    <button
      aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
      className={`active-press flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-xs transition-colors hover:bg-[var(--surface-muted)] ${compact ? "size-11 justify-center px-0" : ""}`}
      onClick={toggleTheme}
      type="button"
    >
      {theme === "dark" ? (
        <>
          <IconMoon className="size-4 text-[var(--leaf)]" />
          {!compact && <span>Dark Mode</span>}
        </>
      ) : (
        <>
          <IconSun className="size-4 text-[var(--sun)]" />
          {!compact && <span>Light Mode</span>}
        </>
      )}
    </button>
  );
}

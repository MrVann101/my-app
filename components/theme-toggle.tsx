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
    return theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getServerTheme(): Theme {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#13110e" : "#faf7f2");
    try {
      window.localStorage.setItem("bitewise-theme", next);
    } catch {}
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <div
      role="group"
      aria-label="Theme mode"
      className="inline-grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] p-1"
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`active-press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors ${
          theme === "light"
            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
            : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <IconSun className="size-4 text-[var(--sun)]" />
        <span>Light</span>
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`active-press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors ${
          theme === "dark"
            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
            : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <IconMoon className="size-4 text-[var(--leaf)]" />
        <span>Dark</span>
      </button>
    </div>
  );
}

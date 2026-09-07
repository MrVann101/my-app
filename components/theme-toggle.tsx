"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "./icons";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("bitewise-theme");
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      } else {
        setTheme("dark");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bitewise-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <button
      aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
      className="active-press flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-xs transition-colors hover:bg-[var(--surface-muted)]"
      onClick={toggleTheme}
      type="button"
    >
      {theme === "dark" ? (
        <>
          <IconMoon className="size-4 text-[var(--leaf)]" />
          <span>Dark Mode</span>
        </>
      ) : (
        <>
          <IconSun className="size-4 text-[var(--sun)]" />
          <span>Light Mode</span>
        </>
      )}
    </button>
  );
}

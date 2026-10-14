"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Paired with the inline script in layout.tsx, which applies the stored theme
 * before first paint. Reading it via a lazy `useState` initializer (rather
 * than an effect) means the client's first render already shows the right
 * icon instead of flashing the SSR default and then correcting itself.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("bass-stats-theme", next);
    } catch {
      // Private browsing or blocked storage — the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      suppressHydrationWarning
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

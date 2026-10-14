"use client";

import { Moon, Sun } from "lucide-react";

/**
 * No React state at all — the icon swap is pure CSS, keyed off the
 * `data-theme` attribute the inline script in layout.tsx sets on <html>
 * before first paint (see the `.icon-sun` / `.icon-moon` rules in
 * globals.css).
 *
 * An earlier version stored the theme in `useState` and read it from the
 * DOM during the client's first render. That is unsafe: the server has to
 * guess a default ("dark") since `document` doesn't exist during SSR, and
 * a visitor whose OS preference resolves the inline script to "light"
 * before hydration runs gets a real hydration mismatch — React discards
 * and re-renders the whole subtree. Driving the swap with CSS means both
 * icons exist in the SSR HTML unconditionally, so there is nothing for
 * hydration to disagree about.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
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
      aria-label="Toggle color theme"
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Sun size={16} className="icon-sun" />
      <Moon size={16} className="icon-moon" />
    </button>
  );
}

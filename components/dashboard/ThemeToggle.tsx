"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains("dark");
    setIsDark(hasDarkClass);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`h-8 w-8 rounded-lg border border-border bg-light-gray/50 ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Alternar tema oscuro y claro"
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white dark:bg-slate-800 text-gray hover:text-dark dark:hover:text-white hover:bg-light-gray dark:hover:bg-slate-700 transition-colors shadow-2xs ${className}`}
    >
      {isDark ? (
        <span
          className="material-symbols-outlined text-[18px] text-amber-400"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          light_mode
        </span>
      ) : (
        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-300">
          dark_mode
        </span>
      )}
    </button>
  );
}


"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Force a white default once for existing users who may have stale dark preference.
    const resetFlag = localStorage.getItem("theme-default-reset-v1");
    if (!resetFlag) {
      localStorage.setItem("theme", "light");
      localStorage.setItem("theme-default-reset-v1", "done");
      setTheme("light");
      applyTheme("light");
      return;
    }

    const stored = localStorage.getItem("theme");
    const resolvedTheme: Theme = stored === "dark" || stored === "light" ? stored : "light";
    setTheme(resolvedTheme);
    applyTheme(resolvedTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="nav-theme-btn"
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
    >
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";

export function BasculeTheme() {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    try {
      const t = localStorage.getItem("eb_theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* stockage indisponible */
    }
  }, []);
  const appliquer = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "auto") localStorage.removeItem("eb_theme");
      else localStorage.setItem("eb_theme", t);
    } catch {
      /* stockage indisponible */
    }
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <div className="inline-flex rounded-xl border border-line bg-card p-1" role="group" aria-label="Thème">
      {(["auto", "light", "dark"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => appliquer(t)}
          className={`min-h-tap rounded-lg px-3 text-sm font-medium ${theme === t ? "bg-brand text-white" : "text-muted"}`}
        >
          {t === "auto" ? "Auto" : t === "light" ? "Clair" : "Sombre"}
        </button>
      ))}
    </div>
  );
}

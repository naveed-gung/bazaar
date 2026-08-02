import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("bazaar.theme", next ? "dark" : "light");
    setDark(next);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      aria-pressed={dark}
      className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-[color,background-color,transform] hover:bg-surface-2 hover:text-foreground active:scale-95"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

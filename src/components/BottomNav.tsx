import { Link, useLocation } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", exact: true },
  { to: "/weekly", label: "Weekly", icon: "📋", exact: false },
  { to: "/tracker", label: "Monthly", icon: "✅", exact: false },
  { to: "/analytics", label: "Analytics", icon: "📈", exact: false },
] as const;

function BottomThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] py-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

export function BottomNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/signin" || location.pathname === "/signup";

  if (isAuthPage) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200/60 dark:border-gray-800/40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl"
      style={{
        paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-around px-1 pt-1.5 h-16">
        {/* ✦ YEARLY TRACKER branding */}
        <Link
          to="/"
          className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] py-1 text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity"
        >
          <span className="text-lg leading-none">✦</span>
          <span className="text-[9px] font-bold leading-none uppercase tracking-wider whitespace-nowrap">
            Yearly Tracker
          </span>
        </Link>

        {/* Navigation tabs */}
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.to === "/tracker" ? { month: undefined } : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] py-1 transition-colors ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Theme toggle */}
        <BottomThemeToggle />

        {/* Sign In (only when not authenticated) */}
        {!isAuthenticated && (
          <Link
            to="/signin"
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] py-1 transition-colors ${
              location.pathname === "/signin"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <span className="text-lg leading-none">👤</span>
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">
              Sign In
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

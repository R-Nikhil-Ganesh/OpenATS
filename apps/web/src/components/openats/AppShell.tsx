import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Users,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Bell,
  Sparkles,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Upload", icon: Upload },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside
      className="glass diag-highlight fixed left-4 top-4 bottom-4 z-20 hidden w-60 flex-col gap-2 p-4 md:flex"
      style={{ borderRadius: 24 }}
    >
      <Link to="/" className="relative z-10 flex items-center gap-3 px-2 py-2">
        <span
          className="glass glass-gold flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-bold text-charcoal-earth"
          style={{ borderRadius: 999 }}
        >
          oA
        </span>
        <span className="font-display text-xl font-bold tracking-tight text-charcoal-earth">
          openats
        </span>
      </Link>
      <nav className="relative z-10 mt-4 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active =
            to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "font-semibold text-charcoal-earth"
                  : "text-warm-taupe hover:text-charcoal-earth",
              )}
              style={
                active
                  ? {
                      background: "var(--ov-gold-soft)",
                      border: "1px solid var(--ov-gold-med)",
                      boxShadow: "inset 0 2px 0 var(--ov-line)",
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div
        className="relative z-10 mt-auto flex items-center gap-3 rounded-2xl px-3 py-2.5"
        style={{
          background: "var(--ov-w-2)",
          border: "1px solid var(--ov-w-3)",
        }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-charcoal-earth"
          style={{ background: "var(--ov-clay-soft)" }}
        >
          L
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-charcoal-earth">Local Admin</div>
          <div className="font-mono-caps truncate text-warm-taupe">admin@openats</div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const hydrated = useHydrated();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("openats-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme, hydrated]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return (
    <header
      className="glass diag-highlight sticky top-4 z-10 mx-auto flex items-center gap-3 px-5 py-3"
      style={{ borderRadius: 20 }}
    >
      <span className="relative z-10 font-display text-lg font-bold tracking-tight text-charcoal-earth md:hidden">
        OpenATS
      </span>
      <div className="relative z-10 ml-auto flex items-center gap-2">
        <button
          type="button"
          suppressHydrationWarning
          aria-label={hydrated ? (theme === "dark" ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"}
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full text-warm-taupe transition-all hover:text-charcoal-earth"
          style={{
            background: "var(--ov-w-1)",
            border: "1px solid var(--ov-line)",
          }}
        >
          <span suppressHydrationWarning>
            {hydrated && theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </span>
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-warm-taupe transition-all hover:text-charcoal-earth"
          style={{
            background: "var(--ov-w-1)",
            border: "1px solid var(--ov-line)",
          }}
        >
          <Bell className="h-4 w-4" />
        </button>
        <div
          className="ml-1 flex items-center gap-2 rounded-full px-2.5 py-1.5"
          style={{
            background: "var(--ov-w-2)",
            border: "1px solid var(--ov-w-3)",
          }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-charcoal-earth"
            style={{
              background: "var(--ov-clay-soft)",
            }}
          >
            L
          </span>
          <span className="text-sm text-charcoal-earth">Local Admin</span>
          <Sparkles className="h-3.5 w-3.5 text-sunlit-clay" />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-[17rem]">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <TopBar />
          <main className="pb-24 pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { MoonStar, SunMedium } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/use-app-store";
import { cn } from "@/lib/utils";

export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("team-task-manager-theme", theme);
  }, [theme]);

  useEffect(() => {
    const stored = window.localStorage.getItem("team-task-manager-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
  }, [setTheme]);

  return (
    <div
      className={cn(
        "min-h-screen bg-[#FFFFFF] text-neutral-900",
        "dark:bg-black dark:text-white",
        "bg-[radial-gradient(circle_at_top_left,rgba(255,138,0,0.12),transparent_40%)]",
        "dark:bg-[radial-gradient(circle_at_top_left,rgba(255,138,0,0.15),transparent_40%)]"
      )}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link href="/login" className="text-sm font-semibold tracking-tight text-[#ff6200] dark:text-[#ff8a00]">
            Team Task Manager
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-[#ff8a00]/35 px-3 py-1.5 dark:border-[#ff8a00]/50">
            <SunMedium className="h-4 w-4 text-[#ff6200]" />
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
            <MoonStar className="h-4 w-4 text-neutral-500 dark:text-neutral-300" />
          </div>
        </header>

        <div className="grid flex-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="rounded-[36px] border-2 border-[#ff6200]/50 bg-white p-8 shadow-lg dark:border-[#ff8a00] dark:bg-neutral-950">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff8a00]/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-[#ff6200] dark:text-[#ff8a00]">
              Secure workspace
            </div>
            <h1 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Plan projects, assign work, and ship with clarity.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
              JWT sessions with HTTP-only cookies, email OTP on signup, role-based access, Kanban boards, and a focused dashboard.
            </p>
            <ul className="mt-8 grid gap-3 text-sm text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
              {[
                "OTP verification via SMTP",
                "Admin & Member roles",
                "Projects, tasks, comments",
                "Drag-and-drop Kanban",
              ].map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-[#ff8a00]/30 bg-[#fff7ef] px-4 py-3 dark:border-[#ff8a00]/35 dark:bg-neutral-900"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[36px] border-2 border-[#ff6200]/45 bg-white p-6 shadow-lg dark:border-[#ff8a00] dark:bg-neutral-950 sm:p-8">
            {children}
            {footer}
          </section>
        </div>
      </div>
    </div>
  );
}

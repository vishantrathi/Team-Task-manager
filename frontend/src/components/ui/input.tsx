import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 shadow-inner outline-none transition focus:border-[#ff6200]/50 focus:ring-2 focus:ring-[#ff6200]/20 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500",
        className
      )}
      {...props}
    />
  );
}

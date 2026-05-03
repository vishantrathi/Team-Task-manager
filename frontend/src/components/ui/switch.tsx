import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root className={cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-neutral-200 bg-neutral-200 p-0.5 shadow-inner transition-colors data-[state=checked]:border-[#ff6200] data-[state=checked]:bg-[#ff6200] dark:border-white/15 dark:bg-white/10", className)} {...props}>
      <SwitchPrimitive.Thumb className="h-5 w-5 rounded-full bg-white shadow-lg transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
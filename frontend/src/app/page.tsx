"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/store/use-app-store";

export default function Home() {
  const router = useRouter();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const loading = useAppStore((s) => s.loading);
  const initializeWorkspace = useAppStore((s) => s.initializeWorkspace);

  useEffect(() => {
    void initializeWorkspace();
  }, [initializeWorkspace]);

  useEffect(() => {
    if (!loading && !currentUserId) {
      router.replace("/login");
    }
  }, [currentUserId, loading, router]);

  if (loading || !currentUserId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
        Loading workspace…
      </div>
    );
  }

  return <AppShell />;
}

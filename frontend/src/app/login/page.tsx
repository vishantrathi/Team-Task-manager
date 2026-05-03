"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/use-app-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const initializeWorkspace = useAppStore((s) => s.initializeWorkspace);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const loading = useAppStore((s) => s.loading);
  const authenticating = useAppStore((s) => s.authenticating);
  const error = useAppStore((s) => s.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    useAppStore.setState({ error: null });
    void initializeWorkspace();
  }, [initializeWorkspace]);

  useEffect(() => {
    if (!loading && currentUserId) {
      router.replace("/");
    }
  }, [currentUserId, loading, router]);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      toast.error("Email and password are required");
      return;
    }
    try {
      await login(email.trim(), password);
      toast.success("Signed in");
      router.replace("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    }
  };

  if (loading && !currentUserId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] text-neutral-600 dark:bg-black dark:text-neutral-300">
        Loading…
      </div>
    );
  }

  return (
    <AuthLayout
      footer={
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          No account?{" "}
          <Link href="/signup" className="font-medium text-[#ff6200] underline-offset-4 hover:underline dark:text-[#ff8a00]">
            Create one
          </Link>
        </p>
      }
    >
      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Sign in with your workspace email and password.</p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          Email
          <Input
            className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
        </label>
        <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          Password
          <Input
            className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        <Button
          className="mt-2 h-11 w-full rounded-2xl bg-[#ff6200] text-white hover:bg-[#e45700]"
          onClick={() => void onSubmit()}
          disabled={authenticating}
        >
          {authenticating ? "Please wait…" : "Sign in"}
        </Button>
      </div>
    </AuthLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/use-app-store";

export default function SignupPage() {
  const router = useRouter();
  const requestSignupOtp = useAppStore((s) => s.requestSignupOtp);
  const verifySignup = useAppStore((s) => s.verifySignup);
  const initializeWorkspace = useAppStore((s) => s.initializeWorkspace);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const loading = useAppStore((s) => s.loading);
  const authenticating = useAppStore((s) => s.authenticating);
  const error = useAppStore((s) => s.error);

  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "Member">("Member");
  const [adminKey, setAdminKey] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    void initializeWorkspace();
  }, [initializeWorkspace]);

  useEffect(() => {
    if (!loading && currentUserId) {
      router.replace("/");
    }
  }, [currentUserId, loading, router]);

  const sendOtp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Name, email, and password are required");
      return;
    }
    try {
      await requestSignupOtp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        adminKey: role === "Admin" ? adminKey : undefined,
      });
      toast.success("Check your email for the verification code");
      setStep("otp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code");
    }
  };

  const confirmOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    try {
      await verifySignup(email.trim().toLowerCase(), otp.trim());
      toast.success("Account verified");
      router.replace("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
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
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#ff6200] underline-offset-4 hover:underline dark:text-[#ff8a00]">
            Sign in
          </Link>
        </p>
      }
    >
      {step === "form" ? (
        <>
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We’ll email you a one-time code to verify your address before activating the workspace.
            </p>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {error}
            </div>
          )}
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              Full name
              <Input
                className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              Email
              <Input
                className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              Password
              <Input
                className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="8+ chars, letters and numbers"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "Admin" | "Member")}
                  className="h-11 rounded-2xl border border-[#ff8a00]/40 bg-white px-3 outline-none dark:border-[#ff8a00]/45 dark:bg-black dark:text-white"
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                Admin invite code
                <Input
                  className="rounded-2xl border-[#ff8a00]/40 bg-white dark:border-[#ff8a00]/45 dark:bg-black"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Required for Admin"
                  disabled={role !== "Admin"}
                />
              </label>
            </div>
            <Button
              className="mt-2 h-11 w-full rounded-2xl bg-[#ff6200] text-white hover:bg-[#e45700]"
              onClick={() => void sendOtp()}
              disabled={authenticating}
            >
              {authenticating ? "Sending…" : "Send verification code"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Enter verification code</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We sent a 6-digit code to <strong>{email}</strong>. It expires in 15 minutes.
            </p>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {error}
            </div>
          )}
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              Code
              <Input
                className="rounded-2xl border-[#ff8a00]/40 bg-white text-center text-2xl tracking-[0.4em] dark:border-[#ff8a00]/45 dark:bg-black"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
              />
            </label>
            <Button
              className="h-11 w-full rounded-2xl bg-[#ff6200] text-white hover:bg-[#e45700]"
              onClick={() => void confirmOtp()}
              disabled={authenticating}
            >
              {authenticating ? "Verifying…" : "Verify and continue"}
            </Button>
            <Button type="button" variant="ghost" className="rounded-2xl" onClick={() => setStep("form")}>
              Back
            </Button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}

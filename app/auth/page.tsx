"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const logoTaps = useRef(0);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [role, setRole] = useState<"lender" | "borrower">("lender");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ceoAccess, setCeoAccess] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("role");
    if (requested === "lender" || requested === "borrower") setRole(requested);
  }, []);

  function handleBrandTap() {
    logoTaps.current += 1;
    if (logoTaps.current >= 10) {
      setCeoAccess(true);
      setMode("login");
      setMessage("CEO sign-in enabled. Use the email and password assigned to your CEO account.");
      logoTaps.current = 0;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name, requested_role: role } },
        });
        if (error) throw error;
        setMessage("Account created. Check your email to confirm your address, then sign in.");
        setMode("login");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Authentication failed.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Failed to retrieve your account role. Contact support.");
      }

      if (profile.role === "lender") router.push("/lender/dashboard");
      else if (profile.role === "borrower") router.push("/borrower/portal");
      else if (profile.role === "ceo") router.push("/ceo/super-admin");
      else throw new Error("This account does not have an assigned platform role.");

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="card w-full max-w-md">
        <button
          type="button"
          onClick={handleBrandTap}
          aria-label="CREDEE"
          className="text-left text-lg font-black text-white"
        >
          CREDEE
        </button>

        <h1 className="mt-8 text-3xl font-bold">
          {ceoAccess ? "CEO sign in" : mode === "register" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="muted mt-2">
          {ceoAccess
            ? "Restricted administrator access."
            : mode === "register"
              ? "Choose the account type that fits you."
              : "Sign in to your private workspace."}
        </p>

        {!ceoAccess && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMode("register"); setMessage(""); }}
              className={`rounded-xl p-3 text-sm ${mode === "register" ? "bg-violet-600" : "bg-white/5"}`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setMessage(""); }}
              className={`rounded-xl p-3 text-sm ${mode === "login" ? "bg-violet-600" : "bg-white/5"}`}
            >
              Sign in
            </button>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && !ceoAccess && (
            <>
              <div>
                <label className="mb-2 block text-sm" htmlFor="account-role">Account type</label>
                <select id="account-role" className="field" value={role} onChange={(event) => setRole(event.target.value as "lender" | "borrower")}>
                  <option value="lender">Lender</option>
                  <option value="borrower">Borrower</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor="full-name">Full name</label>
                <input id="full-name" className="field" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm" htmlFor="email">Email address</label>
            <input id="email" className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="mb-2 block text-sm" htmlFor="password">Password</label>
            <input id="password" className="field" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "register" ? "new-password" : "current-password"} />
          </div>
          <button disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        {message && <p role="status" className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-violet-200">{message}</p>}

        {ceoAccess && (
          <button type="button" onClick={() => { setCeoAccess(false); setMessage(""); }} className="mt-5 text-sm text-violet-300">
            Return to regular sign in
          </button>
        )}
        <Link href="/" className="mt-5 inline-block text-sm text-violet-300 no-underline">← Back to home</Link>
      </div>
    </main>
  );
}

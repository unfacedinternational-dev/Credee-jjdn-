"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const logoTaps = useRef(0);
  const [mode, setMode] = useState<"login" | "register" | "reset">("register");
  const [role, setRole] = useState<"lender" | "borrower">("lender");
  const [selectedPortal, setSelectedPortal] = useState<"lender" | "borrower" | "ceo">("lender");
  const [name, setName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [lenderDirectoryConsent, setLenderDirectoryConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ceoAccess, setCeoAccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("role");
    if (requested === "lender" || requested === "borrower") { setRole(requested); setSelectedPortal(requested); }
    if (params.get("mode") === "reset") setMode("reset");
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function handleBrandTap() {
    logoTaps.current += 1;
    if (logoTaps.current >= 10) {
      document.cookie = "credee_ceo_unlock=1; Max-Age=1800; Path=/ceo; SameSite=Lax; Secure";
      setCeoAccess(true);
      setSelectedPortal("ceo");
      setMode("login");
      setMessage("CEO sign-in enabled. Use the email and password assigned to your CEO account.");
      logoTaps.current = 0;
    }
  }

  function normalizePhone(value: string) {
    const digits = value.replace(/[^0-9+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits.startsWith("63")) return "+" + digits;
    if (digits.startsWith("0")) return "+63" + digits.slice(1);
    return "+63" + digits;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (mode === "reset") {
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
          throw new Error("Use at least 8 characters with uppercase and lowercase letters, a number, and a special character.");
        }
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        setMessage("Your password has been updated. You can now sign in with your new password.");
        return;
      }

      if (mode === "register") {
        const strongPassword = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
        if (!strongPassword) throw new Error("Use at least 8 characters with uppercase and lowercase letters, a number, and a special character.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        if (!fullAddress.trim()) throw new Error("Please enter your complete residential address.");
        const normalizedPhone = normalizePhone(phone);
        if (!/^\+639\d{9}$/.test(normalizedPhone)) throw new Error("Enter a valid Philippine mobile number, such as 09XXXXXXXXX or +639XXXXXXXXX.");
        if (role === "borrower" && !/^https:\/\/(www\.)?facebook\.com\/[^\s]+$/i.test(facebookUrl.trim())) {
          throw new Error("Please enter a valid Facebook profile link beginning with https://facebook.com/");
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          phone: normalizedPhone,
          password,
          options: { data: {
            display_name: name,
            requested_role: role,
            full_address: fullAddress.trim(),
            facebook_url: role === "borrower" ? facebookUrl.trim() : null,
            directory_consent: role === "borrower",
            address_sharing_consent: role === "borrower",
            lender_directory_consent: role === "borrower" ? lenderDirectoryConsent : false,
          } },
        });
        if (error) throw error;
        setPhone(normalizedPhone);
        if (!signUpData.session) {
          throw new Error("Phone confirmation is still enabled in Supabase. Turn off Confirm phone in Authentication settings, then try again. CREDEE does not use SMS verification.");
        }
        setMode("login");
        setMessage("Account created. You can now sign in using your mobile number and password.");
        return;
      }

      // Clear any previously signed-in account in this browser before authenticating.
      // This prevents a CEO session from being reused when another account signs in.
      await supabase.auth.signOut({ scope: "local" });

      const credentials = selectedPortal === "ceo"
        ? { email: email.trim().toLowerCase(), password }
        : { phone: normalizePhone(phone), password };
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword(credentials);
      if (authError) throw authError;
      if (!authData.user) throw new Error("Authentication failed.");

      // Portal selection is checked against roles provisioned in the database.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,roles,suspended_at")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("Failed to retrieve your account permissions. Contact support.");
      }
      if (profile.suspended_at) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("This account is suspended. Please contact Customer Service.");
      }

      const permittedRoles: string[] = Array.isArray(profile.roles) ? profile.roles : [profile.role];
      if (!permittedRoles.includes(selectedPortal)) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("This account is not authorized for the selected portal.");
      }
      if (selectedPortal === "ceo" && !ceoAccess) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("CEO sign-in is available only through the restricted CREDEE logo access.");
      }

      window.location.replace(selectedPortal === "ceo" ? "/ceo/super-admin" : "/dashboard?portal=" + selectedPortal);
      return;
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
          title="CREDEE"
          className="text-left text-3xl font-black tracking-[0.18em] text-amber-300 drop-shadow-[0_2px_0_rgba(236,72,153,0.95)] transition hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400"
          style={{ WebkitTextStroke: "1px #ec4899", textShadow: "0 0 12px rgba(236,72,153,.35), 0 2px 0 #ec4899" }}
        >
          CREDEE
        </button>

        <h1 className="mt-8 text-3xl font-bold">
          {ceoAccess ? "CEO sign in" : mode === "register" ? "Create your account" : mode === "reset" ? "Set a new password" : "Welcome back"}
        </h1>
        <p className="muted mt-2">
          {ceoAccess
            ? "Restricted administrator access."
            : mode === "register"
              ? "Choose the account type that fits you."
              : mode === "reset" ? "Create a new password for your CREDEE account." : "Sign in to your private workspace."}
        </p>

        {!ceoAccess && mode === "login" && (
          <div className="mt-5">
            <label className="mb-2 block text-sm" htmlFor="login-portal">Sign in to</label>
            <select id="login-portal" className="field" value={selectedPortal} onChange={(event) => setSelectedPortal(event.target.value as "lender" | "borrower")}>
              <option value="lender">Lender portal</option>
              <option value="borrower">Borrower portal</option>
            </select>
          </div>
        )}

        {!ceoAccess && mode !== "reset" && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMode("register"); setMessage(""); }}
              aria-pressed={mode === "register"} className={`rounded-xl border p-3 text-sm font-bold transition ${mode === "register" ? "border-amber-300 bg-amber-300 text-slate-950 shadow-[0_0_0_2px_rgba(236,72,153,.55)]" : "border-white/10 bg-white/5 text-violet-200 hover:border-pink-300/60"}`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setMessage(""); }}
              aria-pressed={mode === "login"} className={`rounded-xl border p-3 text-sm font-bold transition ${mode === "login" ? "border-amber-300 bg-amber-300 text-slate-950 shadow-[0_0_0_2px_rgba(236,72,153,.55)]" : "border-white/10 bg-white/5 text-violet-200 hover:border-pink-300/60"}`}
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
                <select id="account-role" className="field" value={role} onChange={(event) => { const nextRole = event.target.value as "lender" | "borrower"; setRole(nextRole); setSelectedPortal(nextRole); }}>
                  <option value="lender">Lender</option>
                  <option value="borrower">Borrower</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor="full-name">Full name</label>
                <input id="full-name" className="field" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor="full-address">Complete residential address</label>
                <textarea id="full-address" className="field min-h-24 resize-y" value={fullAddress} onChange={(event) => setFullAddress(event.target.value)} required autoComplete="street-address" placeholder="House / unit, street, barangay, city, province, postal code" />
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor="mobile-number">Mobile number</label>
                <input id="mobile-number" className="field" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="09XXXXXXXXX" autoComplete="tel" />
              </div>
              {role === "borrower" ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm" htmlFor="facebook-url">Facebook profile link</label>
                    <input id="facebook-url" className="field" type="url" value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} required placeholder="https://www.facebook.com/your.profile" />
                  </div>
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input type="checkbox" className="mt-1" checked={lenderDirectoryConsent} onChange={(event) => setLenderDirectoryConsent(event.target.checked)} required />
                    <span>I agree that my name, full address and Facebook profile link may be shown to registered CREDEE lenders.</span>
                  </label>
                </>
              ) : (
                <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-violet-200">
                  Your name will appear in the CREDEE member directory. Your address and account status are available only to lenders you are connected with in CREDEE.
                </p>
              )}
            </>
          )}

          {mode !== "reset" && (ceoAccess ? <div>
            <label className="mb-2 block text-sm" htmlFor="email">CEO email address</label>
            <input id="email" className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div> : mode === "login" ? <div>
            <label className="mb-2 block text-sm" htmlFor="mobile-number-login">Mobile number</label>
            <input id="mobile-number-login" className="field" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="09XXXXXXXXX" autoComplete="tel" />
          </div> : null)}
          {<div>
            <label className="mb-2 block text-sm" htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>
            <input id="password" className="field" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "register" ? "new-password" : "current-password"} />
            {mode !== "login" && <p className="muted mt-2 text-xs leading-5">Password must contain at least 8 characters, including uppercase letters (A–Z), lowercase letters (a–z), numbers (0–9), and a special character (such as ! @ # $ %).</p>}
          </div>}
          {(mode === "register" || mode === "reset") && (
            <div>
              <label className="mb-2 block text-sm" htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" className="field" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" />
              {confirmPassword && <p className={`mt-2 text-xs ${password === confirmPassword ? "text-emerald-300" : "text-amber-300"}`}>{password === confirmPassword ? "Passwords match." : "Passwords do not match yet."}</p>}
            </div>
          )}
          <button disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "reset" ? "Update password" : "Sign in"}
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, RefreshCw, ShieldCheck, Users, UserRound, Search, AlertCircle } from "lucide-react";

type Account = {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  suspended: boolean;
  directory_consent?: boolean;
};
type CredentialRequest = { id: string; lender_id: string; borrower_id: string; reason: string; requested_fields: string[]; status: string; created_at: string; lender_name?: string; borrower_name?: string };
type Overview = {
  totals: { lenders: number; borrowers: number; loans: number; active_loans: number };
  lenders: Account[];
  borrowers: Account[];
};

export default function CeoAdminRoute() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"lenders" | "borrowers">("lenders");
  const [search, setSearch] = useState("");
  const [resetBusy, setResetBusy] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<Record<string, string>>({});
  const [credentialRequests, setCredentialRequests] = useState<CredentialRequest[]>([]);
  const [credentialActionBusy, setCredentialActionBusy] = useState("");
  const [credentialActionMessage, setCredentialActionMessage] = useState("");

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const db = createClient();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role,roles,suspended_at")
        .eq("id", user.id)
        .single();

      if (profileError || !(profile?.roles ?? [profile?.role]).includes("ceo") || profile.suspended_at) {
        router.replace("/auth?error=role");
        return;
      }

      const { data, error: rpcError } = await db.rpc("get_ceo_overview");
      if (rpcError) throw rpcError;
      if (!data) throw new Error("The administrator overview returned no data.");
      setOverview(data as Overview);
      const { data: requests, error: requestError } = await db.from("credential_requests").select("id,lender_id,borrower_id,reason,requested_fields,status,created_at").order("created_at", { ascending: false }).limit(100);
      if (requestError) throw requestError;
      const requestRows = (requests ?? []) as CredentialRequest[];
      const profileIds = Array.from(new Set(requestRows.flatMap((item) => [item.lender_id, item.borrower_id])));
      const { data: requestProfiles } = profileIds.length ? await db.from("profiles").select("id,display_name").in("id", profileIds) : { data: [] as { id: string; display_name: string }[] };
      const nameMap: Record<string, string> = {};
      (requestProfiles ?? []).forEach((item: { id: string; display_name: string }) => { nameMap[item.id] = item.display_name; });
      setCredentialRequests(requestRows.map((item) => ({ ...item, lender_name: nameMap[item.lender_id] ?? "Lender", borrower_name: nameMap[item.borrower_id] ?? "Borrower" })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the administrator dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const accounts = useMemo(() => {
    const list = tab === "lenders" ? overview?.lenders ?? [] : overview?.borrowers ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((account) =>
      (account.display_name ?? "").toLowerCase().includes(term) ||
      (account.email ?? "").toLowerCase().includes(term)
    );
  }, [overview, tab, search]);

  async function sendPasswordReset(account: Account) {
    if (!account.email) return;
    setResetBusy(account.id);
    setResetStatus((current) => ({ ...current, [account.id]: "" }));
    try {
      const db = createClient();
      const { error: resetError } = await db.auth.resetPasswordForEmail(account.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (resetError) throw resetError;
      setResetStatus((current) => ({ ...current, [account.id]: "Password reset email sent." }));
    } catch (e) {
      setResetStatus((current) => ({ ...current, [account.id]: e instanceof Error ? e.message : "Could not send reset email." }));
    } finally {
      setResetBusy(null);
    }
  }

  async function decideCredentialRequest(request: CredentialRequest, decision: "released" | "rejected") {
    setCredentialActionBusy(request.id); setCredentialActionMessage("");
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setCredentialActionMessage("Please sign in again."); setCredentialActionBusy(""); return; }
    const { error } = await db.from("credential_requests").update({ status: decision, ceo_decided_by: user.id, ceo_decided_at: new Date().toISOString() }).eq("id", request.id).eq("status", "pending");
    if (error) setCredentialActionMessage(error.message);
    else { setCredentialRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: decision } : item)); setCredentialActionMessage(decision === "released" ? "CEO approved. The borrower can now view documents shared by this lender." : "Request rejected."); }
    setCredentialActionBusy("");
  }
  async function signOut() {
    const db = createClient();
    await db.auth.signOut();
    document.cookie = "credee_ceo_unlock=; Max-Age=0; Path=/ceo; SameSite=Lax; Secure";
    router.replace("/auth");
    router.refresh();
  }

  if (loading) {
    return <main className="container min-h-screen py-20 text-center text-violet-200">Loading CREDEE Super Admin…</main>;
  }

  return (
    <main className="container min-h-screen py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="text-xl font-black tracking-wide text-amber-300">CREDEE</div>
          <p className="muted mt-1 text-sm">Super Admin · Restricted administrator area</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadOverview(true)} disabled={refreshing} className="btn btn-outline">
            <RefreshCw size={16} className="mr-2" />{refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <a href="/ceo/customer-service" className="btn btn-primary">Customer Service Inbox</a>
          <button onClick={signOut} className="btn btn-outline"><LogOut size={16} className="mr-2" />Sign out</button>
        </div>
      </header>

      <section className="mt-9">
        <div className="eyebrow">Platform overview</div>
        <h1 className="mt-2 text-3xl font-bold">Administrator dashboard</h1>
        <p className="muted mt-2">View all registered lender and borrower accounts across CREDEE.</p>
      </section>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><strong>Could not load the account directory.</strong><p className="mt-1 break-words">{error}</p><p className="mt-2">If this mentions that get_ceo_overview does not exist, apply the new migration in Supabase SQL Editor.</p></div>
        </div>
      )}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><Users className="text-violet-300" /><p className="muted mt-4 text-sm">Registered lenders</p><p className="mt-1 text-3xl font-bold">{overview?.totals.lenders ?? "—"}</p></div>
        <div className="card"><UserRound className="text-pink-300" /><p className="muted mt-4 text-sm">Registered borrowers</p><p className="mt-1 text-3xl font-bold">{overview?.totals.borrowers ?? "—"}</p></div>
        <div className="card"><ShieldCheck className="text-emerald-300" /><p className="muted mt-4 text-sm">Total loan records</p><p className="mt-1 text-3xl font-bold">{overview?.totals.loans ?? "—"}</p></div>
        <div className="card"><AlertCircle className="text-amber-300" /><p className="muted mt-4 text-sm">Active / overdue loans</p><p className="mt-1 text-3xl font-bold">{overview?.totals.active_loans ?? "—"}</p></div>
      </section>

      <section className="card mt-7">
        <div><h2 className="text-xl font-bold">Borrower credential requests</h2><p className="muted mt-1 text-sm">Review lender requests. CEO approval enables the borrower to view documents uploaded by the requesting lender.</p></div>
        {credentialActionMessage && <p role="status" className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-violet-200">{credentialActionMessage}</p>}
        <div className="mt-4 space-y-3">
          {credentialRequests.map((request) => <article key={request.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{request.borrower_name}</p><p className="muted mt-1 text-xs">Requested by {request.lender_name}</p><p className="muted mt-2 text-sm">{request.reason}</p><p className="muted mt-1 text-xs">Requested: {request.requested_fields.join(", ")}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize">{request.status}</span></div>
            {request.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void decideCredentialRequest(request, "released")} disabled={credentialActionBusy === request.id} className="btn btn-primary px-3 py-2 text-xs">{credentialActionBusy === request.id ? "Saving…" : "Approve request"}</button><button type="button" onClick={() => void decideCredentialRequest(request, "rejected")} disabled={credentialActionBusy === request.id} className="btn btn-outline px-3 py-2 text-xs">Reject</button></div>}
            {request.status === "released" && <p className="mt-3 text-xs text-emerald-200">Approved. The borrower can view shared documents in their workspace.</p>}
          </article>)}
          {credentialRequests.length === 0 && <p className="muted rounded-xl border border-white/10 p-6 text-center text-sm">No credential requests yet.</p>}
        </div>
      </section>
      <section className="card mt-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Account directory</h2>
            <p className="muted mt-1 text-sm">All accounts, not limited to borrower directory consent.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setTab("lenders"); setSearch(""); }} className={`rounded-xl px-4 py-2 text-sm ${tab === "lenders" ? "bg-violet-600 text-white" : "bg-white/5 text-violet-200"}`}>Lenders ({overview?.totals.lenders ?? 0})</button>
            <button onClick={() => { setTab("borrowers"); setSearch(""); }} className={`rounded-xl px-4 py-2 text-sm ${tab === "borrowers" ? "bg-violet-600 text-white" : "bg-white/5 text-violet-200"}`}>Borrowers ({overview?.totals.borrowers ?? 0})</button>
          </div>
        </div>

        <div className="relative mt-5">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-300" />
          <input className="field pl-10" placeholder={`Search ${tab} by name or email…`} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="muted"><tr><th className="p-3">Name</th><th className="p-3">Email / password recovery</th><th className="p-3">Registered</th><th className="p-3">Account status</th>{tab === "borrowers" && <th className="p-3">Directory sharing</th>}</tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-white/10">
                  <td className="p-3 font-medium">{account.display_name || "Unnamed account"}</td>
                  <td className="p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-violet-200">{account.email || "—"}</span><button type="button" onClick={() => void sendPasswordReset(account)} disabled={!account.email || resetBusy === account.id} className="rounded-lg border border-amber-300/40 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50">{resetBusy === account.id ? "Sending…" : "Send reset link"}</button></div><p className="mt-1 text-xs text-violet-300/70">Password is private and cannot be viewed.</p>{resetStatus[account.id] && <p role="status" className="mt-1 text-xs text-emerald-300">{resetStatus[account.id]}</p>}</td>
                  <td className="p-3">{new Date(account.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</td>
                  <td className="p-3"><span className={account.suspended ? "text-red-300" : "text-emerald-300"}>{account.suspended ? "Suspended" : "Active"}</span></td>
                  {tab === "borrowers" && <td className="p-3">{account.directory_consent ? "Opted in" : "Private"}</td>}
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={tab === "borrowers" ? 5 : 4} className="p-8 text-center muted">{search ? "No matching accounts found." : `No registered ${tab} yet.`}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted mt-4 text-xs">Showing {accounts.length} {tab} account{accounts.length === 1 ? "" : "s"}.</p>
      </section>
    </main>
  );
}

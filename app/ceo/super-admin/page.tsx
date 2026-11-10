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
        .select("role,suspended_at")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "ceo" || profile.suspended_at) {
        router.replace("/auth?error=role");
        return;
      }

      const { data, error: rpcError } = await db.rpc("get_ceo_overview");
      if (rpcError) throw rpcError;
      if (!data) throw new Error("The administrator overview returned no data.");
      setOverview(data as Overview);
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

  async function signOut() {
    const db = createClient();
    await db.auth.signOut();
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
            <thead className="muted"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Registered</th><th className="p-3">Account status</th>{tab === "borrowers" && <th className="p-3">Directory sharing</th>}</tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-white/10">
                  <td className="p-3 font-medium">{account.display_name || "Unnamed account"}</td>
                  <td className="p-3 text-violet-200">{account.email || "—"}</td>
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

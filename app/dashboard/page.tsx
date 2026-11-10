"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, ShieldCheck, Users, Wallet, Clock3, CheckCircle2 } from "lucide-react";

type Profile = { display_name: string | null; role: "lender" | "borrower"; directory_consent: boolean };
type BorrowerDirectoryItem = { borrower_id: string; display_name: string; full_address: string | null; completed_loans: number; average_rating: number | null; five_star_loans: number; late_loans: number; contributing_lenders: number };
type BorrowerCredentialRequest = { id: string; reason: string; requested_fields: string[]; status: string; created_at: string };
type Loan = {
  id: string;
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  due_date: string;
  status: string;
  created_at: string;
  rating: number | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [communityBorrowers, setCommunityBorrowers] = useState<BorrowerDirectoryItem[]>([]);
  const [credentialRequests, setCredentialRequests] = useState<Record<string, string>>({});
  const [borrowerCredentialRequests, setBorrowerCredentialRequests] = useState<BorrowerCredentialRequest[]>([]);
  const [credentialMessage, setCredentialMessage] = useState("");
  const [credentialBusyId, setCredentialBusyId] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setEmail(user.email ?? "");
      const { data: p, error: pe } = await supabase.from("profiles")
        .select("display_name,role,roles,directory_consent").eq("id", user.id).single();
      if (pe || !p) {
        setError("Your profile is not ready yet. Please contact Customer Service.");
        setLoading(false);
        return;
      }
      const availableRoles: string[] = Array.isArray(p.roles) ? p.roles : [p.role];
      const requestedPortal = new URLSearchParams(window.location.search).get("portal");
      const activePortal = requestedPortal === "lender" || requestedPortal === "borrower"
        ? requestedPortal
        : (p.role === "lender" || p.role === "borrower" ? p.role : null);
      if (!activePortal || !availableRoles.includes(activePortal)) { router.replace("/auth?error=role"); return; }
      setProfile({ ...p, role: activePortal } as Profile);
      setConsent(Boolean(p.directory_consent));
      if (activePortal === "lender") {
        const { data: directoryData } = await supabase.rpc("get_shared_account_directory");
        setCommunityBorrowers((directoryData?.borrowers ?? []) as BorrowerDirectoryItem[]);
        const { data: requestRows } = await supabase.from("credential_requests").select("borrower_id,status,created_at").eq("lender_id", user.id).order("created_at", { ascending: false });
        const requestMap: Record<string, string> = {};
        (requestRows ?? []).forEach((request: { borrower_id: string; status: string }) => { if (!requestMap[request.borrower_id]) requestMap[request.borrower_id] = request.status; });
        setCredentialRequests(requestMap);
      } else {
        const { data: requestRows } = await supabase.from("credential_requests").select("id,reason,requested_fields,status,created_at").eq("borrower_id", user.id).order("created_at", { ascending: false });
        setBorrowerCredentialRequests((requestRows ?? []) as BorrowerCredentialRequest[]);
      }
      const { data: l, error: loanError } = await supabase.from("loans")
        .select("id,borrower_id,principal_amount,interest_rate,due_date,status,created_at,rating")
        .order("created_at", { ascending: false }).limit(50);
      if (loanError) setError(loanError.message);
      setLoans((l ?? []) as Loan[]);
      setLoading(false);
    })();
  }, [router]);

  async function saveConsent() {
    const db = createClient();
    const { error } = await db.from("profiles").update({ directory_consent: !consent })
      .eq("id", (await db.auth.getUser()).data.user?.id);
    if (error) { setConsentMessage(error.message); return; }
    setConsent(!consent);
    setConsentMessage(!consent ? "Your borrower summary is now shared in the community directory." : "Your borrower summary is no longer shared.");
  }

  async function markPaymentReceived(loan: Loan, checked: boolean) {
    if (!checked || profile?.role !== "lender" || loan.status === "completed") return;
    const confirmed = window.confirm("Confirm that you have received the borrower's FULL payment for this loan? This will complete the loan and calculate the borrower's stars based on the payment date.");
    if (!confirmed) return;
    setMarkingId(loan.id);
    setPaymentMessage("");
    const { data, error } = await createClient().rpc("mark_loan_paid", { p_loan_id: loan.id });
    if (error) {
      setPaymentMessage(error.message);
    } else {
      setLoans((current) => current.map((item) => item.id === loan.id
        ? { ...item, status: "completed", rating: Number(data.rating) }
        : item));
      setPaymentMessage(`Payment recorded. Borrower rating: ${Number(data.rating).toFixed(0)} / 5 stars. ${Number(data.days_late) === 0 ? "Paid on or before the due date." : `Recorded ${data.days_late} day(s) late.`}`);
    }
    setMarkingId("");
  }

  async function askCeoToShareCredentials(borrowerId: string) {
    if (profile?.role !== "lender") return;
    setCredentialBusyId(borrowerId); setCredentialMessage("");
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setCredentialMessage("Please sign in again."); setCredentialBusyId(""); return; }
    const { error } = await db.from("credential_requests").insert({
      lender_id: user.id, borrower_id: borrowerId,
      reason: "Please review this request and coordinate the borrower's approved credential sharing.",
      requested_fields: ["borrower_credentials"], status: "pending",
    });
    if (error) setCredentialMessage(error.message);
    else { setCredentialRequests((current) => ({ ...current, [borrowerId]: "pending" })); setCredentialMessage("Your request has been sent to the CREDEE CEO for review."); }
    setCredentialBusyId("");
  }

  async function consentToCredentialSharing(request: BorrowerCredentialRequest) {
    setCredentialBusyId(request.id); setCredentialMessage("");
    const { error } = await createClient().from("credential_requests")
      .update({ borrower_consented_at: new Date().toISOString(), status: "released" })
      .eq("id", request.id).eq("status", "approved");
    if (error) setCredentialMessage(error.message);
    else setBorrowerCredentialRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "released" } : item));
    setCredentialBusyId("");
  }
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) return <main className="container py-20 text-center text-violet-200">Loading your secure workspace…</main>;

  return (
    <main className="container min-h-screen py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="font-black text-amber-300">CREDEE</div>
          <p className="muted mt-1 text-sm">Private workspace</p>
        </div>
        <div className="flex gap-2">
          <a href={"/directory?portal="+profile?.role} className="btn btn-outline">Community directory</a>
          <button onClick={logout} className="btn btn-outline"><LogOut size={16} className="mr-2" /> Sign out</button>
        </div>
      </header>

      {error && <div role="alert" className="card mt-8 text-sm text-amber-200">{error}</div>}

      <div className="mt-10">
        <div className="eyebrow">{profile?.role ?? "Account"} workspace</div>
        <h1 className="mt-2 text-3xl font-bold">Welcome, {profile?.display_name || email}</h1>
        <p className="muted mt-2">{email}</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card"><Users className="text-violet-300" /><p className="muted mt-4 text-sm">Account type</p><p className="mt-1 text-xl font-bold capitalize">{profile?.role}</p></div>
        <div className="card"><Wallet className="text-amber-300" /><p className="muted mt-4 text-sm">Loan records visible to your account</p><p className="mt-1 text-xl font-bold">{loans.length}</p></div>
        <div className="card"><ShieldCheck className="text-emerald-300" /><p className="muted mt-4 text-sm">Privacy status</p><p className="mt-1 text-xl font-bold">Private by default</p></div>
      </div>

      {profile?.role === "borrower" && (
        <section className="card mt-7">
          <h2 className="text-xl font-bold">Borrower directory consent</h2>
          <p className="muted mt-2 text-sm leading-6">If enabled, all registered CREDEE members can see a limited summary of your completed loan ratings. Your phone, email, address, ID photos and agreements are not shown in the directory.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveConsent} className="btn btn-outline">{consent ? "Turn off sharing" : "Share my repayment summary"}</button>
            <span className="muted text-xs">Current status: {consent ? "Sharing enabled" : "Not shared"}</span>
          </div>
          {consentMessage && <p className="mt-3 text-sm text-violet-200">{consentMessage}</p>}
        </section>
      )}

      <section className="card mt-7">
        <div className="flex items-center gap-2"><Clock3 className="text-violet-300" /><h2 className="text-xl font-bold">Loan records</h2></div>
        {profile?.role === "lender" && <p className="muted mt-2 text-sm leading-6">When you have received the borrower's full payment, tick the box to record it. CREDEE will automatically complete the loan and calculate the borrower's stars from the due date. Only tick it after the full payment has actually been received.</p>}
        {paymentMessage && <p role="status" className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-violet-200">{paymentMessage}</p>}
        {loans.length === 0 ? <p className="muted mt-5">No loan records are linked to this account yet.</p> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="muted"><tr>
                {profile?.role === "lender" && <th className="p-3">Borrower account</th>}
                <th className="p-3">Principal</th><th className="p-3">Interest</th><th className="p-3">Due date</th><th className="p-3">Status</th>
                {profile?.role === "lender" && <th className="p-3">Payment received</th>}
                <th className="p-3">Stars</th>
              </tr></thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-t border-white/10">
                    {profile?.role === "lender" && <td className="p-3 font-mono text-xs">{loan.borrower_id.slice(0, 8)}…</td>}
                    <td className="p-3">₱{Number(loan.principal_amount).toLocaleString("en-PH")}</td>
                    <td className="p-3">{loan.interest_rate}%</td>
                    <td className="p-3">{loan.due_date}</td>
                    <td className="p-3 capitalize">{loan.status}</td>
                    {profile?.role === "lender" && (
                      <td className="p-3">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={loan.status === "completed"} disabled={loan.status === "completed" || markingId === loan.id || !["active", "overdue"].includes(loan.status)} onChange={(event) => void markPaymentReceived(loan, event.target.checked)} />
                          <span className="text-xs">{markingId === loan.id ? "Saving…" : loan.status === "completed" ? "Recorded" : "Full payment received"}</span>
                        </label>
                      </td>
                    )}
                    <td className="p-3">{loan.rating === null ? "—" : <span className="inline-flex items-center gap-1 text-amber-300"><CheckCircle2 size={14} /> {Number(loan.rating).toFixed(0)} / 5</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

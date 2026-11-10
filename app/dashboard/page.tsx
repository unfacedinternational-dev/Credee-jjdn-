"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, ShieldCheck, Users, Wallet, Clock3, CheckCircle2, Search, UploadCloud, FileText, ExternalLink } from "lucide-react";

type Profile = { display_name: string | null; role: "lender" | "borrower"; directory_consent: boolean; address_sharing_consent: boolean; full_address: string | null; facebook_url: string | null; lender_directory_consent: boolean };
type AssignedBorrower = { borrower_id: string; display_name: string; full_address: string | null; current_status: string; loan_count: number }; type BorrowerSearchResult = { borrower_id: string; display_name: string }; type BorrowerDocument = { id: string; lender_id: string; borrower_id: string; file_path: string; file_name: string; mime_type: string; file_size: number; created_at: string };
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
  const [profileAddress, setProfileAddress] = useState("");
  const [profileFacebook, setProfileFacebook] = useState("");
  const [lenderDirectoryConsent, setLenderDirectoryConsent] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [assignedBorrowers, setAssignedBorrowers] = useState<AssignedBorrower[]>([]);
  const [borrowerSearch, setBorrowerSearch] = useState("");
  const [borrowerSearchResults, setBorrowerSearchResults] = useState<BorrowerSearchResult[]>([]);
  const [borrowerSearchMessage, setBorrowerSearchMessage] = useState("");
  const [documents, setDocuments] = useState<BorrowerDocument[]>([]);
  const [documentBusyId, setDocumentBusyId] = useState("");
  const [credentialRequests, setCredentialRequests] = useState<Record<string, string>>({});
  const [credentialMessage, setCredentialMessage] = useState("");
  const [credentialBusyId, setCredentialBusyId] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data: p, error: pe } = await supabase.from("profiles")
        .select("display_name,role,roles,directory_consent,address_sharing_consent,full_address,facebook_url,lender_directory_consent").eq("id", user.id).single();
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
      setProfileAddress(p.full_address ?? "");
      setProfileFacebook(p.facebook_url ?? "");
      setLenderDirectoryConsent(Boolean(p.lender_directory_consent));
      if (activePortal === "lender") {
        const { data: assigned } = await supabase.rpc("get_lender_borrowers");
        setAssignedBorrowers((assigned ?? []) as AssignedBorrower[]);
        const { data: requestRows } = await supabase.from("credential_requests").select("borrower_id,status,created_at").eq("lender_id", user.id).order("created_at", { ascending: false });
        const requestMap: Record<string, string> = {};
        (requestRows ?? []).forEach((request: { borrower_id: string; status: string }) => { if (!requestMap[request.borrower_id]) requestMap[request.borrower_id] = request.status; });
        setCredentialRequests(requestMap);
      }
      const { data: documentRows } = await supabase.from("borrower_documents").select("id,lender_id,borrower_id,file_path,file_name,mime_type,file_size,created_at").eq(activePortal === "lender" ? "lender_id" : "borrower_id", user.id).order("created_at", { ascending: false });
      setDocuments((documentRows ?? []) as BorrowerDocument[]);
      const { data: l, error: loanError } = await supabase.from("loans")
        .select("id,borrower_id,principal_amount,interest_rate,due_date,status,created_at,rating")
        .order("created_at", { ascending: false }).limit(50);
      if (loanError) setError(loanError.message);
      setLoans((l ?? []) as Loan[]);
      setLoading(false);
    })();
  }, [router]);

  async function saveMemberDetails() {
    setProfileSaving(true); setProfileMessage("");
    if (!profileAddress.trim()) { setProfileMessage("Please enter your complete residential address."); setProfileSaving(false); return; }
    if (profile?.role === "lender" && !/^https:\/\/(www\.)?facebook\.com\/[^\s]+$/i.test(profileFacebook.trim())) { setProfileMessage("Enter a valid Facebook profile link beginning with https://facebook.com/."); setProfileSaving(false); return; }
    const updates: Record<string, unknown> = { full_address: profileAddress.trim() };
    if (profile?.role === "lender") { updates.facebook_url = profileFacebook.trim(); updates.lender_directory_consent = lenderDirectoryConsent; }
    const db = createClient();
    const { error } = await db.from("profiles").update(updates).eq("id", (await db.auth.getUser()).data.user?.id);
    setProfileMessage(error ? error.message : "Your profile details have been saved.");
    setProfileSaving(false);
  }
  async function refreshAssignedBorrowers() {
    const { data, error } = await createClient().rpc("get_lender_borrowers");
    if (error) setBorrowerSearchMessage(error.message);
    else setAssignedBorrowers((data ?? []) as AssignedBorrower[]);
  }
  async function searchBorrowers() {
    setBorrowerSearchMessage("");
    if (borrowerSearch.trim().length < 2) { setBorrowerSearchResults([]); setBorrowerSearchMessage("Enter at least two letters to search."); return; }
    const { data, error } = await createClient().rpc("search_borrowers_for_lender", { p_query: borrowerSearch.trim() });
    if (error) setBorrowerSearchMessage(error.message);
    else setBorrowerSearchResults((data ?? []) as BorrowerSearchResult[]);
  }
  async function addBorrower(borrower: BorrowerSearchResult) {
    const db = createClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return;
    const { error } = await db.rpc("add_borrower_to_lender", { p_borrower_id: borrower.borrower_id });
    if (error) setBorrowerSearchMessage(error.message);
    else { setBorrowerSearchMessage(borrower.display_name + " has been added to your borrower list."); setBorrowerSearchResults(current => current.filter(item => item.borrower_id !== borrower.borrower_id)); await refreshAssignedBorrowers(); }
  }
  async function uploadBorrowerDocument(borrowerId: string, file?: File) {
    if (!file) return;
    if (!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)) { setCredentialMessage("Upload a PDF, JPG, PNG or WebP file."); return; }
    if (file.size > 10*1024*1024) { setCredentialMessage("Each document must be 10 MB or smaller."); return; }
    setDocumentBusyId(borrowerId); setCredentialMessage("");
    const db=createClient(); const {data:{user}}=await db.auth.getUser();
    if(!user){setCredentialMessage("Please sign in again.");setDocumentBusyId("");return;}
    const documentId=crypto.randomUUID(); const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"document";
    const filePath=user.id+"/"+borrowerId+"/"+documentId+"-"+safeName;
    const {error:metadataError}=await db.from("borrower_documents").insert({id:documentId,lender_id:user.id,borrower_id:borrowerId,file_path:filePath,file_name:file.name,mime_type:file.type,file_size:file.size});
    if(metadataError){setCredentialMessage(metadataError.message);setDocumentBusyId("");return;}
    const {error:uploadError}=await db.storage.from("credee-private").upload(filePath,file,{contentType:file.type,upsert:false,cacheControl:"60"});
    if(uploadError){await db.from("borrower_documents").delete().eq("id",documentId);setCredentialMessage(uploadError.message);}
    else{const {data:rows}=await db.from("borrower_documents").select("id,lender_id,borrower_id,file_path,file_name,mime_type,file_size,created_at").eq("lender_id",user.id).order("created_at",{ascending:false});setDocuments((rows??[]) as BorrowerDocument[]);setCredentialMessage("Document uploaded. The borrower can view it after CEO approval.");}
    setDocumentBusyId("");
  }
  async function openBorrowerDocument(document: BorrowerDocument) {
    const preview = window.open("about:blank", "_blank");
    const {data,error}=await createClient().storage.from("credee-private").createSignedUrl(document.file_path,300);
    if(error||!data?.signedUrl){preview?.close();setCredentialMessage(error?.message??"Could not open this document.");return;}
    if(preview) preview.location.href=data.signedUrl;
    else setCredentialMessage("Allow pop-ups to view this document.");
  }
  async function refreshBorrowerDocuments() {
    const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user)return;
    const {data,error}=await db.from("borrower_documents").select("id,lender_id,borrower_id,file_path,file_name,mime_type,file_size,created_at").eq(profile?.role==="lender"?"lender_id":"borrower_id",user.id).order("created_at",{ascending:false});
    if(error)setCredentialMessage(error.message);else setDocuments((data??[]) as BorrowerDocument[]);
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
    const { error } = await db.rpc("request_borrower_document_approval", { p_borrower_id: borrowerId });
    if (error) setCredentialMessage(error.message);
    else { setCredentialRequests((current) => ({ ...current, [borrowerId]: "pending" })); setCredentialMessage("Your document access request has been sent to the CREDEE CEO."); }
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
        <h1 className="mt-2 text-3xl font-bold">Welcome, {profile?.display_name || "Member"}</h1>
      </div>

      <section className="card mt-7">
        <h2 className="text-xl font-bold">Profile details</h2>
        <p className="muted mt-2 text-sm">{profile?.role === "borrower" ? "Your name appears in the member directory. Your address and current loan status are visible only to lenders connected to you in CREDEE." : "Keep your contact information current and manage your lender contact details."}</p>
        <div className="mt-4"><label className="mb-2 block text-sm" htmlFor="workspace-address">Complete residential address</label><textarea id="workspace-address" className="field min-h-24 resize-y" value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} placeholder="House / unit, street, barangay, city, province, postal code" /></div>
        {profile?.role === "lender" && <>
          <div className="mt-4"><label className="mb-2 block text-sm" htmlFor="workspace-facebook">Facebook profile link</label><input id="workspace-facebook" type="url" className="field" value={profileFacebook} onChange={(event) => setProfileFacebook(event.target.value)} placeholder="https://www.facebook.com/your.profile" /></div>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1" checked={lenderDirectoryConsent} onChange={(event) => setLenderDirectoryConsent(event.target.checked)} /><span>Show my name, address and Facebook profile to registered CREDEE borrowers.</span></label>
        </>}
        <button type="button" onClick={() => void saveMemberDetails()} disabled={profileSaving} className="btn btn-primary mt-4">{profileSaving ? "Saving…" : "Save profile details"}</button>
        {profileMessage && <p role="status" className="mt-3 text-sm text-violet-200">{profileMessage}</p>}
      </section>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card"><Users className="text-violet-300" /><p className="muted mt-4 text-sm">Account type</p><p className="mt-1 text-xl font-bold capitalize">{profile?.role}</p></div>
        <div className="card"><Wallet className="text-amber-300" /><p className="muted mt-4 text-sm">Loan records visible to your account</p><p className="mt-1 text-xl font-bold">{loans.length}</p></div>
      </div>



      {profile?.role === "lender" && (
        <section className="card mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow">Lender tools</div><h2 className="mt-2 text-xl font-bold">Add a borrower</h2><p className="muted mt-2 text-sm">Search registered CREDEE borrowers by name and add them to your private borrower list.</p></div><button type="button" onClick={()=>void refreshAssignedBorrowers()} className="btn btn-outline px-3 py-2 text-xs">Refresh list</button></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-300"/><input className="field pl-10" value={borrowerSearch} onChange={e=>setBorrowerSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void searchBorrowers();}}} placeholder="Search borrower by full name"/></div><button type="button" onClick={()=>void searchBorrowers()} className="btn btn-primary"><Search size={16} className="mr-2"/>Search</button></div>
          {borrowerSearchMessage&&<p role="status" className="mt-3 text-sm text-violet-200">{borrowerSearchMessage}</p>}
          {borrowerSearchResults.length>0&&<div className="mt-3 space-y-2">{borrowerSearchResults.map(item=><div key={item.borrower_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="font-semibold">{item.display_name}</span><button type="button" onClick={()=>void addBorrower(item)} className="btn btn-outline px-3 py-2 text-xs">Add to my borrowers</button></div>)}</div>}
          <div className="mt-7 border-t border-white/10 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">My borrowers</h3><p className="muted mt-1 text-sm">Address and current loan status are shown in your connected lender workspace.</p></div><span className="muted text-sm">{assignedBorrowers.length} borrower(s)</span></div>
            {credentialMessage&&<p role="status" className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-violet-200">{credentialMessage}</p>}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {assignedBorrowers.map(borrower=>{const requestStatus=credentialRequests[borrower.borrower_id];const borrowerDocs=documents.filter(doc=>doc.borrower_id===borrower.borrower_id);return <article key={borrower.borrower_id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold">{borrower.display_name || "CREDEE borrower"}</h4><p className="muted mt-1 text-xs">{borrower.full_address||"Address not provided"}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{borrower.current_status}</span></div><p className="muted mt-2 text-xs">{borrower.loan_count} loan record(s)</p>
                <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void askCeoToShareCredentials(borrower.borrower_id)} disabled={Boolean(requestStatus&&["pending","approved","released"].includes(requestStatus))||credentialBusyId===borrower.borrower_id} className="btn btn-outline px-3 py-2 text-xs">{credentialBusyId===borrower.borrower_id?"Sending…":requestStatus==="pending"?"CEO review pending":requestStatus==="approved"?"CEO approved":requestStatus==="released"?"CEO approved · borrower access enabled": "Request CEO document approval"}</button><label className="btn btn-primary cursor-pointer px-3 py-2 text-xs"><UploadCloud size={14} className="mr-2 inline"/>{documentBusyId===borrower.borrower_id?"Uploading…":"Upload document"}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={documentBusyId===borrower.borrower_id} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadBorrowerDocument(borrower.borrower_id,file);e.currentTarget.value="";}}/></label></div>
                <div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-xs font-semibold text-violet-200">Uploaded documents</p>{borrowerDocs.length===0?<p className="muted text-xs">No documents uploaded.</p>:borrowerDocs.map(doc=><button type="button" key={doc.id} onClick={()=>void openBorrowerDocument(doc)} className="flex w-full items-center gap-2 py-2 text-left text-xs text-sky-300 hover:underline"><FileText size={15}/><span className="min-w-0 flex-1 truncate">{doc.file_name}</span><ExternalLink size={13}/></button>)}</div>
              </article>;})}
              {assignedBorrowers.length===0&&<p className="muted rounded-xl border border-white/10 p-6 text-center text-sm md:col-span-2">You have not added any borrowers yet. Search above to add one.</p>}
            </div>
          </div>
        </section>
      )}


      {profile?.role === "borrower" && (
        <section className="card mt-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">My documents</h2><p className="muted mt-2 text-sm">Documents shared by your connected lender appear here after CEO approval. This is a view-only area; you cannot replace or delete uploaded files.</p></div><button type="button" onClick={()=>void refreshBorrowerDocuments()} className="btn btn-outline px-3 py-2 text-xs">Refresh documents</button></div>
          {documents.length===0?<p className="muted mt-5 text-sm">No approved documents are available yet.</p>:<div className="mt-4 space-y-2">{documents.map(doc=><button type="button" key={doc.id} onClick={()=>void openBorrowerDocument(doc)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-3 text-left hover:bg-white/5"><FileText className="text-violet-300"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{doc.file_name}</span><span className="muted mt-1 block text-xs">{new Date(doc.created_at).toLocaleString("en-PH")}</span></span><ExternalLink size={15} className="text-sky-300"/></button>)}</div>}
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

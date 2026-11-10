"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, Users, UserRound } from "lucide-react";
type Lender={display_name:string;created_at:string;full_address:string|null;facebook_url:string|null};
type Borrower={borrower_id:string;display_name:string};
type Directory={lenders:Lender[];borrowers:Borrower[]};
export default function DirectoryPage(){
 const router=useRouter();const [role,setRole]=useState("");const [directory,setDirectory]=useState<Directory>({lenders:[],borrowers:[]});const [tab,setTab]=useState<"lenders"|"borrowers">("borrowers");const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{(async()=>{const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user){router.replace("/auth");return;}const {data:p}=await db.from("profiles").select("role,roles,suspended_at").eq("id",user.id).single();const availableRoles:string[]=Array.isArray(p?.roles)?p.roles:[p?.role];const requestedPortal=new URLSearchParams(window.location.search).get("portal");const activeRole=requestedPortal==="lender"||requestedPortal==="borrower"?requestedPortal:(p?.role==="lender"||p?.role==="borrower"?p.role:null);if(!p||p.suspended_at||!activeRole||!availableRoles.includes(activeRole)){router.replace("/auth?error=role");return;}setRole(activeRole);const {data,error}=await db.rpc("get_shared_account_directory");if(error){setError(error.message);setLoading(false);return;}setDirectory((data??{lenders:[],borrowers:[]}) as Directory);setLoading(false);})();},[router]);
 const entries=useMemo(()=>{const term=query.trim().toLowerCase();return tab==="lenders"?directory.lenders.filter(x=>x.display_name.toLowerCase().includes(term)):directory.borrowers.filter(x=>x.display_name.toLowerCase().includes(term));},[directory,tab,query]);
 if(loading)return <main className="container py-20 text-center text-violet-200">Loading community directory…</main>;
 return <main className="container min-h-screen py-8">
  <header className="flex items-center justify-between border-b border-white/10 pb-5"><Link href={"/dashboard?portal="+role} className="font-black tracking-wide text-amber-300 no-underline">CREDEE</Link><Link href={"/dashboard?portal="+role} className="text-sm text-violet-300 no-underline">← Workspace</Link></header>
  <section className="mt-9"><div className="eyebrow">CREDEE community</div><h1 className="mt-2 text-3xl font-bold">Lenders & borrowers</h1><p className="muted mt-3 max-w-2xl leading-7">Find CREDEE members by name. Borrower repayment details and private documents are kept in the connected lender workspace.</p></section>
  <div className="mt-7 flex flex-wrap gap-2"><button onClick={()=>setTab("lenders")} aria-pressed={tab==="lenders"} className={`rounded-xl px-5 py-3 text-sm font-semibold ${tab==="lenders"?"bg-violet-600 text-white":"bg-white/5 text-violet-200"}`}><Users size={16} className="mr-2 inline"/>Lenders ({directory.lenders.length})</button><button onClick={()=>setTab("borrowers")} aria-pressed={tab==="borrowers"} className={`rounded-xl px-5 py-3 text-sm font-semibold ${tab==="borrowers"?"bg-violet-600 text-white":"bg-white/5 text-violet-200"}`}><UserRound size={16} className="mr-2 inline"/>Borrowers ({directory.borrowers.length})</button></div>
  <div className="relative mt-5 max-w-xl"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-300"/><input className="field pl-10" placeholder={`Search ${tab} by name…`} value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
  <div className="mt-6 grid gap-4 md:grid-cols-2">
   {tab==="lenders"&&entries.map((item:any,i:number)=><article className="card" key={`${item.display_name}-${i}`}><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-500/15 p-3"><Users className="text-violet-300"/></div><div><h2 className="font-bold">{item.display_name}</h2><p className="muted mt-1 text-xs">CREDEE lender</p></div></div>{item.full_address&&<p className="mt-4 text-sm"><span className="muted">Address: </span>{item.full_address}</p>}{item.facebook_url&&<a href={item.facebook_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-semibold text-sky-300 underline">Message this lender on Facebook ↗</a>}</article>)}
   {tab==="borrowers"&&entries.map((item:any)=><article className="card" key={item.borrower_id}><div className="flex items-center gap-3"><div className="rounded-xl bg-pink-500/15 p-3"><UserRound className="text-pink-300"/></div><div><h2 className="font-bold">{item.display_name}</h2><p className="muted mt-1 text-xs">CREDEE borrower</p></div></div></article>)}
   {entries.length===0&&!error&&<div className="card md:col-span-2"><p className="muted text-center">{query?"No matching members found.":`No ${tab} listed yet.`}</p></div>}
  </div>
 </main>;
}

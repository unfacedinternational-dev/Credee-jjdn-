"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, MessageCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
type Role = "lender" | "borrower" | "ceo";
type Conversation = { id:string; user_id:string; subject:string; status:"open"|"closed"; created_at:string; last_message_at:string };
type Message = { id:string; conversation_id:string; sender_id:string; sender_role:Role; body:string; created_at:string };
export default function SupportChat({admin=false}:{admin?:boolean}) {
 const router=useRouter(); const [role,setRole]=useState<Role|null>(null); const [userId,setUserId]=useState("");
 const [conversations,setConversations]=useState<Conversation[]>([]); const [names,setNames]=useState<Record<string,string>>({});
 const [selectedId,setSelectedId]=useState(""); const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState(""); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [notice,setNotice]=useState("");
 const loadConversations=useCallback(async(silent=false)=>{
  const db=createClient(); if(!silent)setLoading(true);
  const {data:{user}}=await db.auth.getUser(); if(!user){router.replace("/auth");return;} setUserId(user.id);
  const {data:profile}=await db.from("profiles").select("role,suspended_at").eq("id",user.id).single();
  const currentRole=profile?.role as Role|undefined;
  if(!currentRole||profile?.suspended_at||(admin&&currentRole!=="ceo")||(!admin&&!["lender","borrower","ceo"].includes(currentRole))){router.replace("/auth?error=role");return;}
  setRole(currentRole);
  if (!admin && currentRole === "ceo") { router.replace("/ceo/customer-service"); return; }
  let query=db.from("support_conversations").select("id,user_id,subject,status,created_at,last_message_at").order("last_message_at",{ascending:false});
  if(!admin)query=query.eq("user_id",user.id);
  const {data,error}=await query; if(error){setNotice(error.message);setLoading(false);return;}
  const rows=(data??[]) as Conversation[]; setConversations(rows);
  if(admin&&rows.length){const ids=Array.from(new Set(rows.map(x=>x.user_id)));const {data:profiles}=await db.from("profiles").select("id,display_name").in("id",ids);const map:Record<string,string>={};(profiles??[]).forEach((p:any)=>map[p.id]=p.display_name||"CREDEE user");setNames(map);}
  setSelectedId(current=>rows.some(x=>x.id===current)?current:(rows[0]?.id??""));setLoading(false);
 },[admin,router]);
 const loadMessages=useCallback(async(silent=false)=>{if(!selectedId){setMessages([]);return;}const {data,error}=await createClient().from("support_messages").select("id,conversation_id,sender_id,sender_role,body,created_at").eq("conversation_id",selectedId).order("created_at",{ascending:true});if(error){if(!silent)setNotice(error.message);return;}setMessages((data??[]) as Message[]);},[selectedId]);
 useEffect(()=>{void loadConversations();},[loadConversations]); useEffect(()=>{void loadMessages();},[loadMessages]);
 useEffect(()=>{const timer=window.setInterval(()=>{void loadConversations(true);void loadMessages(true);},6000);return()=>window.clearInterval(timer);},[loadConversations,loadMessages]);
 const selected=useMemo(()=>conversations.find(x=>x.id===selectedId)??null,[conversations,selectedId]);
 async function startConversation(){if(admin||!userId)return;setBusy(true);setNotice("");const {data,error}=await createClient().from("support_conversations").insert({user_id:userId,subject:"Customer Service"}).select("id,user_id,subject,status,created_at,last_message_at").single();if(error)setNotice(error.message);else{const row=data as Conversation;setConversations(cur=>[row,...cur]);setSelectedId(row.id);setMessages([]);}setBusy(false);}
 async function sendMessage(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const body=draft.trim();if(!body||!selected||!role)return;setBusy(true);setNotice("");const db=createClient();if(admin&&selected.status==="closed"){const {error}=await db.from("support_conversations").update({status:"open"}).eq("id",selected.id);if(error){setNotice(error.message);setBusy(false);return;}}
 const {error}=await db.from("support_messages").insert({conversation_id:selected.id,sender_id:userId,sender_role:role,body});if(error)setNotice(error.message);else{setDraft("");await loadMessages(true);await loadConversations(true);}setBusy(false);}
 async function closeConversation(){if(!admin||!selected)return;const {error}=await createClient().from("support_conversations").update({status:"closed"}).eq("id",selected.id);if(error)setNotice(error.message);else await loadConversations(true);}
 if(loading)return <main className="container py-20 text-center text-violet-200">Loading customer service…</main>;
 return <main className="container min-h-screen py-8">
  <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"><div><a href={admin?"/ceo/super-admin":"/dashboard"} className="inline-flex items-center gap-2 text-sm text-violet-300 no-underline"><ArrowLeft size={15}/>{admin?"Super Admin":"Back to workspace"}</a><h1 className="mt-3 flex items-center gap-2 text-3xl font-bold"><MessageCircle className="text-amber-300"/>{admin?"Customer Service Inbox":"Customer Service"}</h1><p className="muted mt-2">{admin?"Private support conversations from CREDEE accounts. Replies are saved in each conversation.":"Send a message to CREDEE Customer Service. Your conversation history stays saved in your account."}</p></div><button className="btn btn-outline" onClick={()=>{void loadConversations();void loadMessages();}}><RefreshCw size={16} className="mr-2"/>Refresh</button></header>
  {notice&&<div role="alert" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{notice}</div>}
  <div className="grid min-h-[560px] gap-5 lg:grid-cols-[320px_1fr]">
   <aside className="card"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{admin?"All conversations":"Your conversations"}</h2>{!admin&&<button onClick={startConversation} disabled={busy} className="btn btn-primary px-3 py-2 text-xs">New message</button>}</div><div className="mt-4 space-y-2">{conversations.map(c=><button key={c.id} onClick={()=>setSelectedId(c.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId===c.id?"border-violet-400 bg-violet-500/15":"border-white/10 bg-white/[.03]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{admin?names[c.user_id]||"CREDEE user":c.subject}</span><span className={`text-[10px] uppercase ${c.status==="open"?"text-emerald-300":"text-slate-400"}`}>{c.status}</span></div><p className="muted mt-1 text-xs">{new Date(c.last_message_at).toLocaleString("en-PH")}</p></button>)}{conversations.length===0&&<p className="muted py-8 text-center text-sm">{admin?"No support messages have arrived yet.":"No messages yet. Start a conversation whenever you need help."}</p>}</div></aside>
   <section className="card flex min-h-[560px] flex-col">{selected?<><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><h2 className="font-bold">{admin?names[selected.user_id]||"CREDEE user":"CREDEE Customer Service"}</h2><p className="muted mt-1 text-xs">Conversation started {new Date(selected.created_at).toLocaleString("en-PH")}</p></div>{admin&&selected.status==="open"&&<button onClick={closeConversation} className="btn btn-outline px-3 py-2 text-xs">Close conversation</button>}</div>
   <div className="flex-1 space-y-3 overflow-y-auto py-5">{messages.map(m=>{const own=m.sender_id===userId;return <div key={m.id} className={`flex ${own?"justify-end":"justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${own?"bg-violet-600/30":"bg-white/[.06]"}`}><div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-violet-200">{m.sender_role==="ceo"&&<ShieldCheck size={12} />}{m.sender_role==="ceo"?"CREDEE Support":own?"You":"Account holder"}</div><p className="whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p><p className="muted mt-2 text-right text-[10px]">{new Date(m.created_at).toLocaleString("en-PH")}</p></div></div>;})}{messages.length===0&&<p className="muted py-12 text-center text-sm">Send the first message to begin.</p>}</div>
   <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/10 pt-4"><textarea className="field min-h-[52px] flex-1 resize-y" rows={2} maxLength={5000} placeholder="Write your message…" value={draft} onChange={e=>setDraft(e.target.value)} required/><button disabled={busy||!draft.trim()} className="btn btn-primary self-end"><Send size={16} className="mr-2"/>Send</button></form><p className="muted mt-2 text-xs">Messages are stored in CREDEE and visible only to this account and Super Admin.</p>
   </>:<div className="flex flex-1 flex-col items-center justify-center text-center"><MessageCircle size={34} className="text-violet-300"/><h2 className="mt-4 text-xl font-bold">{admin?"Select a conversation":"Contact Customer Service"}</h2><p className="muted mt-2 max-w-sm text-sm">{admin?"Choose an account on the left to read its messages and send a reply.":"Start a new conversation and our support inbox will receive it."}</p>{!admin&&<button onClick={startConversation} disabled={busy} className="btn btn-primary mt-5">Start a conversation</button>}</div>}</section>
  </div>
 </main>;
}

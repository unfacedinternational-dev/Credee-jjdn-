"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export default function CustomerServiceButton(){const [visible,setVisible]=useState(false);useEffect(()=>{const db=createClient();db.auth.getUser().then(({data})=>setVisible(Boolean(data.user)));const {data:listener}=db.auth.onAuthStateChange((_event,session)=>setVisible(Boolean(session?.user)));return()=>listener.subscription.unsubscribe();},[]);if(!visible)return null;return <Link href="/customer-service" aria-label="Customer Service" className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-pink-300/70 bg-amber-300 px-5 py-3 font-bold text-slate-950 shadow-[0_8px_30px_rgba(0,0,0,.35)] transition hover:scale-105"><MessageCircle size={19}/>Customer Service</Link>;}

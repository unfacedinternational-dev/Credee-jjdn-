"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export default function CustomerServiceButton(){const [visible,setVisible]=useState(false);useEffect(()=>{const db=createClient();db.auth.getUser().then(({data})=>setVisible(Boolean(data.user)));const {data:listener}=db.auth.onAuthStateChange((_event,session)=>setVisible(Boolean(session?.user)));return()=>listener.subscription.unsubscribe();},[]);if(!visible)return null;return <Link href="/customer-service" aria-label="Customer Service" className="fixed bottom-3 right-3 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-pink-300/70 bg-amber-300 p-0 font-bold text-slate-950 shadow-[0_8px_30px_rgba(0,0,0,.35)] transition hover:scale-105 sm:bottom-5 sm:right-5 sm:h-auto sm:w-auto sm:gap-2 sm:px-5 sm:py-3" title="Customer Service"><MessageCircle size={21}/><span className="hidden sm:inline">Customer Service</span></Link>;}

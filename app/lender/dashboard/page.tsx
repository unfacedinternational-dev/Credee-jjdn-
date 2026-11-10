"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function LenderDashboardRoute(){const router=useRouter();useEffect(()=>{(async()=>{const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user){router.replace("/auth");return;}const {data:p}=await db.from("profiles").select("role").eq("id",user.id).single();if(p?.role!=="lender"){router.replace("/auth");return;}router.replace("/dashboard");})();},[router]);return <main className="container py-20 text-center text-violet-200">Opening your lender workspace…</main>;}

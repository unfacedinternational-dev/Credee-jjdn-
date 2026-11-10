"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function BorrowerPortalRoute(){const router=useRouter();useEffect(()=>{(async()=>{const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user){router.replace("/auth");return;}const {data:p}=await db.from("profiles").select("role,roles").eq("id",user.id).single();if(!(p?.roles ?? [p?.role]).includes("borrower")){router.replace("/auth?error=role");return;}router.replace("/dashboard?portal=borrower");})();},[router]);return <main className="container py-20 text-center text-violet-200">Opening your borrower portal…</main>;}

"use client";

// Compatibility export for snippets that import from @/lib/supabaseClient.
// The project uses @supabase/ssr through this shared browser client.
export { createClient as supabase } from "@/lib/supabase/client";

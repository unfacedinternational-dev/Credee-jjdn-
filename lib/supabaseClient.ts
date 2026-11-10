"use client";

import { createClient } from "@/lib/supabase/client";

// Compatibility singleton for code snippets importing { supabase }.
export const supabase = createClient();

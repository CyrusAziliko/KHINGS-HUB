import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.VAULTDESK_CONFIG;

if (!config) {
  throw new Error("VAULTDESK_CONFIG is not loaded.");
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
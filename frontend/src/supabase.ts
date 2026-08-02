// Supabase Auth client (ADR-031). Sign-in happens against Supabase (Google
// OAuth primary, email magic link fallback); the backend only ever sees the
// resulting access token as a Bearer header and verifies it against the
// project JWKS. The publishable key is public by design.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "https://sgkyiistoezuvsdfwzqg.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_uvVmEuIi4JR2SUyU2h953g_XP--kRUg";

export const supabase = createClient(url, key);

// config/db.js
// ─────────────────────────────────────────────────────────────
// Creates and exports the Supabase client.
// Uses SUPABASE_SECRET (new key system) with fallback to legacy
// SUPABASE_SERVICE_ROLE_KEY for backward compatibility.
// This key bypasses Row Level Security — never expose it to the frontend.
// ─────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer new secret key system; fall back to legacy service role key
const supabaseServiceKey = process.env.SUPABASE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SECRET (or SUPABASE_SERVICE_ROLE_KEY) in .env');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;

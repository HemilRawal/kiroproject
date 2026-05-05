// config/db.js
// ─────────────────────────────────────────────────────────────
// Creates and exports the Supabase client.
// We use the SERVICE ROLE KEY here (server-side only).
// This key bypasses Row Level Security — never expose it to the frontend.
// ─────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;

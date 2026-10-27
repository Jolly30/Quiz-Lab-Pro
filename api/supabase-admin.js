/* global process */
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses Row Level Security, server-side only
// NEVER expose SUPABASE_SERVICE_KEY to the browser
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
// Prefer service key if valid JWT; fallback to anon key
const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim()?.replace(/^["']|["']$/g, '');
const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()?.replace(/^["']|["']$/g, '');
const key = (serviceKey && serviceKey.startsWith('eyJ')) ? serviceKey : (serviceKey || anonKey);

const supabaseAdmin = createClient(supabaseUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export { supabaseAdmin };

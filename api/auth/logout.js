import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers['x-session-token'];
  if (token) {
    try {
      await supabaseAdmin.from('sessions').delete().eq('token', token);
    } catch (err) {
      console.warn('Logout delete session error:', err.message);
    }
  }

  return res.status(200).json({ ok: true });
}

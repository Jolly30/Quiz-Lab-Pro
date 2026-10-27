import { supabaseAdmin } from './supabase-admin.js';

async function getUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  try {
    const { data } = await supabaseAdmin
      .from('sessions')
      .select('user_id, email')
      .eq('token', token)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user || !user.user_id) {
    return res.status(401).json({ error: 'Unauthorized: valid session required' });
  }

  const userIds = [user.user_id, user.email].filter(Boolean);

  try {
    // GET: Retrieve user's saved Gemini key
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('user_settings')
        .select('gemini_key')
        .in('user_id', userIds)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Fetch user settings error:', error.message);
      }
      return res.status(200).json({ gemini_key: data?.gemini_key || null });
    }

    // POST: Save/upsert user's Gemini key
    if (req.method === 'POST') {
      const { gemini_key } = req.body;
      for (const targetId of userIds) {
        await supabaseAdmin
          .from('user_settings')
          .upsert({
            user_id: targetId,
            gemini_key: gemini_key || null,
            updated_at: Date.now()
          }, { onConflict: 'user_id' });
      }
      return res.status(200).json({ ok: true });
    }

    // DELETE: Remove user's Gemini key
    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('user_settings')
        .delete()
        .in('user_id', userIds);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Settings API fatal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

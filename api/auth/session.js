import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('user_id, email, name, avatar_url, expires_at')
      .eq('token', token)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    return res.status(200).json({
      user: {
        id: data.user_id,
        uid: data.user_id, // Compatibility with existing code
        email: data.email,
        name: data.name,
        displayName: data.name,
        photoURL: data.avatar_url
      }
    });
  } catch (err) {
    console.error('Session lookup error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

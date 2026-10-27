/* global process */
import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  const { code, error } = req.query;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = process.env.APP_URL || `${protocol}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  if (error) {
    return res.redirect(302, `${origin}/#auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(302, `${origin}/#auth_error=missing_code`);
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      return res.redirect(302, `${origin}/#auth_error=${encodeURIComponent(tokenData.error_description || 'token_exchange_failed')}`);
    }

    // 2. Fetch user profile from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userRes.json();

    if (!googleUser.id || !googleUser.email) {
      return res.redirect(302, `${origin}/#auth_error=profile_fetch_failed`);
    }

    // 3. Create session in Supabase sessions table
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar_url: googleUser.picture || null,
      })
      .select('token')
      .single();

    if (sessionError || !session?.token) {
      console.error('Failed to create session in Supabase:', sessionError);
      return res.redirect(302, `${origin}/#auth_error=session_creation_failed`);
    }

    // 4. Redirect to application frontend with session token in hash fragment
    return res.redirect(302, `${origin}/#session_token=${session.token}`);
  } catch (err) {
    console.error('OAuth callback fatal error:', err);
    return res.redirect(302, `${origin}/#auth_error=${encodeURIComponent(err.message || 'unknown_error')}`);
  }
}

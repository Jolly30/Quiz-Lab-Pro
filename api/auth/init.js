/* global process */
export default function handler(req, res) {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = process.env.APP_URL || `${protocol}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured.' });
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });

  return res.redirect(302, `${rootUrl}?${params.toString()}`);
}

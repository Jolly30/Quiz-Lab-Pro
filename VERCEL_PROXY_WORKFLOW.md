# Quiz Lab Pro — Vercel Proxy Migration
### Fix Myanmar ISP Block · No VPN Required · Full Sync Preserved

---

## Why This Is Needed

```
PROBLEM:  Browser → supabase.co        ← BLOCKED in Myanmar
SOLUTION: Browser → vercel.app/api/*   ← NOT blocked
                        ↓
                    supabase.co         ← Server-to-server, NOT blocked
```

The browser **never touches supabase.co directly**.
All Supabase calls happen on the Vercel server, which is not blocked.

---

## How The New Flow Works

### Login (Google OAuth)
```
1. User clicks "Sign in with Google"
2. App calls /api/auth/init → gets Google OAuth URL
3. Browser redirects to accounts.google.com ← NOT blocked
4. Google redirects to /api/auth/callback (Vercel) ← NOT blocked
5. Vercel exchanges code → gets user info from Google
6. Vercel creates a session token → stores in Supabase (server-side)
7. Vercel redirects to app with token in URL hash
8. App stores token in localStorage → user is logged in ✅
```

### Data Sync
```
Before: Browser → supabase.co (BLOCKED)
After:  Browser → /api/modules (Vercel) → supabase.co (server, not blocked)
```

---

## Phase 1 — New Supabase Table (Run SQL in Supabase)

Add a `sessions` table to track login sessions:

```sql
create table sessions (
  token uuid default gen_random_uuid() primary key,
  user_id text not null,
  email text not null,
  name text,
  avatar_url text,
  expires_at timestamptz default now() + interval '30 days',
  created_at timestamptz default now()
);

-- Only server (service key) can access sessions
alter table sessions enable row level security;
-- No RLS policy needed — only accessed via service key server-side
```

---

## Phase 2 — New Vercel API Routes (AI does this)

### Files to create:

```
api/
  auth/
    init.js        ← returns Google OAuth URL to redirect to
    callback.js    ← handles Google redirect, creates session
    session.js     ← returns current user info from token
    logout.js      ← deletes session token
  modules.js       ← GET (list), POST (upsert), DELETE, PUT (rename)
  settings.js      ← GET/POST user's Gemini API key
```

---

### `api/auth/init.js` — Start Google Login

```js
export default function handler(req, res) {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.APP_URL + '/api/auth/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });
  res.redirect(rootUrl + '?' + params.toString());
}
```

---

### `api/auth/callback.js` — Handle Google Redirect

```js
import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  const { code } = req.query;

  // 1. Exchange code for tokens with Google
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.APP_URL + '/api/auth/callback',
      grant_type: 'authorization_code',
    })
  });
  const { access_token } = await tokenRes.json();

  // 2. Get user info from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const googleUser = await userRes.json();
  // googleUser = { id, email, name, picture }

  // 3. Create session in Supabase
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .insert({
      user_id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture,
    })
    .select('token')
    .single();

  // 4. Redirect back to app with token
  res.redirect(`${process.env.APP_URL}/#session_token=${session.token}`);
}
```

---

### `api/auth/session.js` — Get Current User

```js
import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data } = await supabaseAdmin
    .from('sessions')
    .select('user_id, email, name, avatar_url, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!data) return res.status(401).json({ error: 'Invalid or expired token' });
  res.json({ user: data });
}
```

---

### `api/auth/logout.js` — Sign Out

```js
import { supabaseAdmin } from '../supabase-admin.js';

export default async function handler(req, res) {
  const token = req.headers['x-session-token'];
  if (token) {
    await supabaseAdmin.from('sessions').delete().eq('token', token);
  }
  res.json({ ok: true });
}
```

---

### `api/modules.js` — Module CRUD

```js
import { supabaseAdmin } from './supabase-admin.js';

// Helper: verify session and get user_id
async function getUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
  return data?.user_id ?? null;
}

export default async function handler(req, res) {
  const userId = await getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all modules
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('modules')
      .select('display_name, content, folder_name')
      .eq('user_id', userId);
    return res.json(data || []);
  }

  // POST — upsert module
  if (req.method === 'POST') {
    const { display_name, content, folder_name } = req.body;
    await supabaseAdmin.from('modules').upsert(
      { user_id: userId, display_name, content, folder_name, updated_at: Date.now() },
      { onConflict: 'user_id,display_name' }
    );
    return res.json({ ok: true });
  }

  // DELETE — delete module
  if (req.method === 'DELETE') {
    const { display_name } = req.body;
    await supabaseAdmin.from('modules')
      .delete().eq('user_id', userId).eq('display_name', display_name);
    return res.json({ ok: true });
  }

  // PUT — rename (update display_name or folder_name)
  if (req.method === 'PUT') {
    const { old_name, new_name, folder_name, content } = req.body;
    if (new_name && old_name) {
      // Rename: insert new, delete old
      const { data: existing } = await supabaseAdmin.from('modules')
        .select('content, folder_name').eq('user_id', userId).eq('display_name', old_name).single();
      await supabaseAdmin.from('modules').upsert(
        { user_id: userId, display_name: new_name,
          content: content || existing?.content,
          folder_name: folder_name || existing?.folder_name,
          updated_at: Date.now() },
        { onConflict: 'user_id,display_name' }
      );
      await supabaseAdmin.from('modules').delete()
        .eq('user_id', userId).eq('display_name', old_name);
    } else if (folder_name) {
      // Rename folder for multiple modules
      const { modules } = req.body; // array of display_names
      await Promise.all((modules || []).map(name =>
        supabaseAdmin.from('modules')
          .update({ folder_name })
          .eq('user_id', userId).eq('display_name', name)
      ));
    }
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
```

---

### `api/settings.js` — Gemini API Key

```js
import { supabaseAdmin } from './supabase-admin.js';

async function getUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from('sessions').select('user_id')
    .eq('token', token).gt('expires_at', new Date().toISOString()).single();
  return data?.user_id ?? null;
}

export default async function handler(req, res) {
  const userId = await getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('user_settings').select('gemini_key').eq('user_id', userId).single();
    return res.json({ gemini_key: data?.gemini_key ?? null });
  }

  if (req.method === 'POST') {
    const { gemini_key } = req.body;
    await supabaseAdmin.from('user_settings').upsert(
      { user_id: userId, gemini_key, updated_at: Date.now() }
    );
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await supabaseAdmin.from('user_settings').delete().eq('user_id', userId);
    return res.json({ ok: true });
  }
}
```

---

## Phase 3 — New Environment Variables

Add to `.env` and Vercel dashboard:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
APP_URL=http://localhost:5173
```

For Vercel production, set `APP_URL=https://your-app.vercel.app`

Also update **Google Cloud Console → Authorized redirect URIs** to add:
```
https://your-app.vercel.app/api/auth/callback
http://localhost:5173/api/auth/callback
```

---

## Phase 4 — Frontend Changes in App.jsx (AI does this)

### Remove Supabase JS client from browser entirely

```js
// REMOVE THIS:
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(...);
```

### Add simple API helper

```js
// Helper: all API calls go through Vercel
const SESSION_TOKEN_KEY = 'qlp_session_token';
const getToken = () => localStorage.getItem(SESSION_TOKEN_KEY);
const apiHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Session-Token': getToken() || ''
});
```

### Auth state change → check token on load

```js
// BEFORE (Supabase):
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null);
});

// AFTER (Vercel API):
useEffect(() => {
  // Check for token in URL hash (from OAuth callback)
  const hash = window.location.hash;
  if (hash.includes('session_token=')) {
    const token = hash.split('session_token=')[1];
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    window.location.hash = ''; // clean URL
  }

  const token = getToken();
  if (!token) { setLoading(false); return; }

  fetch('/api/auth/session', { headers: apiHeaders() })
    .then(r => r.json())
    .then(({ user }) => { setUser(user || null); setLoading(false); })
    .catch(() => { setLoading(false); });
}, []);
```

### Google Login

```js
// BEFORE:
await supabase.auth.signInWithOAuth({ provider: 'google', ... });

// AFTER:
window.location.href = '/api/auth/init';
```

### Logout

```js
// BEFORE:
await supabase.auth.signOut();

// AFTER:
await fetch('/api/auth/logout', { method: 'POST', headers: apiHeaders() });
localStorage.removeItem(SESSION_TOKEN_KEY);
setUser(null);
```

### Load modules (replaces onSnapshot / loadModules)

```js
// AFTER:
const loadModules = async () => {
  const res = await fetch('/api/modules', { headers: apiHeaders() });
  const data = await res.json();
  const newData = {};
  const newFolders = {};
  (data || []).forEach(row => {
    let parsedQs = [];
    try { parsedQs = JSON.parse(row.content); } catch(e) {}
    newData[row.display_name] = parsedQs;
    newFolders[row.display_name] = row.folder_name || 'Saved Modules';
  });
  setSections(newData);
  setModuleFolders(newFolders);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(newFolders));
};

// Poll every 30s for cross-device sync (replaces realtime WebSocket)
useEffect(() => {
  if (!user) return;
  loadModules();
  const interval = setInterval(loadModules, 30000);
  return () => clearInterval(interval);
}, [user]);
```

### Save module

```js
// BEFORE:
await supabase.from('modules').upsert({...});

// AFTER:
await fetch('/api/modules', {
  method: 'POST',
  headers: apiHeaders(),
  body: JSON.stringify({ display_name: name, content: JSON.stringify(questions), folder_name: folder })
});
```

### Delete module

```js
// AFTER:
await fetch('/api/modules', {
  method: 'DELETE',
  headers: apiHeaders(),
  body: JSON.stringify({ display_name: name })
});
```

### Rename module

```js
// AFTER:
await fetch('/api/modules', {
  method: 'PUT',
  headers: apiHeaders(),
  body: JSON.stringify({ old_name: oldName, new_name: trimmedNew })
});
```

### Rename folder

```js
// AFTER:
await fetch('/api/modules', {
  method: 'PUT',
  headers: apiHeaders(),
  body: JSON.stringify({ folder_name: trimmedNew, modules: modulesToUpdate })
});
```

---

## Phase 5 — Update parse.js to use session token

```js
// In api/parse.js — replace uid-based lookup with session token
const token = req.headers['x-session-token'] || req.body.sessionToken;
if (token) {
  const { data: session } = await supabaseAdmin
    .from('sessions').select('user_id')
    .eq('token', token).single();
  if (session) {
    const { data: settings } = await supabaseAdmin
      .from('user_settings').select('gemini_key')
      .eq('user_id', session.user_id).single();
    if (settings?.gemini_key) { /* decode and use */ }
  }
}
```

---

## Phase 6 — Update Google Cloud Console

Add new redirect URI for the Vercel proxy callback:
```
https://your-app.vercel.app/api/auth/callback
http://localhost:5173/api/auth/callback
```

Remove (or keep) the old Supabase callback — it's no longer needed.

---

## Phase 7 — Deploy & Test

```bash
# Test locally
npm run dev

# Test flow:
# 1. Click "Sign in with Google"
# 2. Goes to accounts.google.com ✅
# 3. Comes back to localhost:5173 ✅
# 4. User logged in ✅
# 5. Create a module → check Supabase table ✅
# 6. Turn OFF VPN → test everything still works ✅

# Deploy
git add .
git commit -m "feat: proxy all Supabase calls through Vercel (Myanmar ISP fix)"
git push
```

---

## Summary of Changes

| File | Action |
|------|--------|
| `api/auth/init.js` | NEW — starts Google OAuth |
| `api/auth/callback.js` | NEW — handles OAuth callback |
| `api/auth/session.js` | NEW — returns current user |
| `api/auth/logout.js` | NEW — signs out |
| `api/modules.js` | NEW — all module CRUD |
| `api/settings.js` | NEW — Gemini key management |
| `api/parse.js` | MODIFY — use session token |
| `src/App.jsx` | MODIFY — remove Supabase client, use fetch() |
| `.env` | MODIFY — add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL |

## What Does NOT Change

- ✅ All quiz features (MCQ, FIB, Matching, True/False)
- ✅ All UI and styling
- ✅ localStorage fallback
- ✅ AI module generation
- ✅ Folder system
- ✅ Dark mode, Burmese/English language

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Something breaks | localStorage fallback — data never lost |
| OAuth callback fails | Test locally before deploying |
| Session expires | 30-day sessions, graceful logout |
| Vercel cold start | Sub-second for small routes |

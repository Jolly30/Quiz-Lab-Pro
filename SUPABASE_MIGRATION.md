# Quiz Lab Pro — Firebase → Supabase Migration
### Google Login Only · Cloud Sync Preserved · Myanmar ISP Safe

---

## Overview

```
BEFORE:  App → Firebase (googleapis.com)     ← BLOCKED in Myanmar
AFTER:   App → Supabase (supabase.co / AWS)  ✅ NOT blocked
              + Google OAuth (accounts.google.com) ✅ NOT blocked
```

---

## Phase 1 — Supabase Project Setup
> ⚠️ You need VPN for this phase only (to access supabase.com). After setup, VPN is never needed again.

### 1.1 Create Account & Project

1. Open VPN → go to https://supabase.com
2. Click **Start your project** → sign up (GitHub login is easiest)
3. Click **New Project** and fill in:
   - **Name:** `quiz-lab-pro`
   - **Database Password:** choose a strong password and save it
   - **Region:** `Southeast Asia (Singapore)` ← closest to Myanmar
4. Click **Create new project** and wait ~2 minutes

---

### 1.2 Get Your API Keys

1. Go to **Settings → API**
2. Copy and save these 3 values:

```
Project URL:       https://xxxxxxxxxxxx.supabase.co
anon public key:   eyJhbGci...   (long JWT string)
service_role key:  eyJhbGci...   (another long JWT — keep this SECRET)
```

---

### 1.3 Create Database Tables

1. Go to **SQL Editor → New Query**
2. Paste and run this SQL:

```sql
-- Modules table (replaces Firestore 'modules' collection)
create table modules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  display_name text not null,
  content text not null,
  folder_name text default 'Saved Modules',
  updated_at bigint default extract(epoch from now()) * 1000,
  unique (user_id, display_name)  -- ⚠️ Required: lets upsert update instead of inserting duplicate rows
);

-- Settings table (replaces Firestore 'settings/apiKeys' doc)
create table user_settings (
  user_id uuid references auth.users primary key,
  gemini_key text,
  updated_at bigint default extract(epoch from now()) * 1000
);

-- Row Level Security: users can only see their own data
alter table modules enable row level security;
alter table user_settings enable row level security;

create policy "Users own their modules" on modules
  for all using (auth.uid() = user_id);

create policy "Users own their settings" on user_settings
  for all using (auth.uid() = user_id);

-- ⚠️ Required: enables real-time sync — without this, cross-device sync silently fails
alter publication supabase_realtime add table modules;
```

3. Click **Run** — you should see "Success. No rows returned."

---

### 1.4 Enable Google OAuth

#### Step A — Google Cloud Console

1. Go to https://console.cloud.google.com
2. Select your existing Firebase project (or create new one)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**, Name: `Quiz Lab Pro`
6. Under **Authorized redirect URIs** add:
   ```
   https://xxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
   *(replace xxxxxxxxxxxx with your Supabase project ID)*
7. Click **Create** → copy **Client ID** and **Client Secret**

#### Step B — Supabase Auth Settings

1. In Supabase → **Authentication → Providers → Google** → toggle **ON**
2. Paste your **Client ID** and **Client Secret** → click **Save**

#### Step C — URL Configuration (both Site URL AND Redirect URLs)

> ⚠️ **Important:** Google login with Supabase is a **full-page redirect**, not a popup like Firebase.
> The user leaves your page → goes to Google → comes back. This is normal and expected.

1. In Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your production URL:
   ```
   https://your-app.vercel.app
   ```
   *(This is separate from Redirect URLs — both must be set)*
3. Under **Redirect URLs** add:
   ```
   https://your-app.vercel.app/**
   http://localhost:5173/**
   ```
4. Click **Save**

---

## Phase 2 — Environment Variables

### 2.1 Local `.env` file

Replace old Firebase vars with:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
SUPABASE_SERVICE_KEY=eyJhbGci...your-service-role-key...
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
```

> `VITE_` prefix exposes the variable to the browser.
> `SUPABASE_SERVICE_KEY` must NOT have `VITE_` — it is server-side only.

### 2.2 Vercel Dashboard

1. Go to Vercel → your project → **Settings → Environment Variables**
2. Add all 5 variables above
3. Redeploy after saving

---

## Phase 3 — Code Changes
> AI does this step. Listed here for reference.

### Packages

```bash
npm uninstall firebase firebase-admin
npm install @supabase/supabase-js
```

### Files Changed

| File | Change |
|------|--------|
| `src/App.jsx` | Swap Firebase SDK → Supabase SDK (~80 lines) |
| `api/firebase-admin.js` | Rewrite as `supabase-admin.js` (~20 lines) |
| `api/parse.js` | Update API key lookup (~15 lines) |
| `.env` | Add 5 new Supabase env vars |

### Key Code Swaps

| Before (Firebase) | After (Supabase) |
|---|---|
| `signInWithPopup(auth, googleProvider)` | `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` *(full-page redirect, not popup)* |
| `onAuthStateChanged(auth, callback)` | `supabase.auth.onAuthStateChange(callback)` |
| `signOut(auth)` | `supabase.auth.signOut()` |
| `onSnapshot(collection(...))` | `supabase.from('modules').select()` + realtime channel |
| `setDoc(doc(...), data)` | `supabase.from('modules').upsert(data)` |
| `deleteDoc(doc(...))` | `supabase.from('modules').delete().eq(...)` |
| `updateDoc(doc(...), data)` | `supabase.from('modules').update(data).eq(...)` |
| `getDoc(doc(...))` | `supabase.from('user_settings').select().single()` |

---

## Phase 4 — Deploy & Test

### 4.1 Test Locally
```bash
npm run dev
```
- Click **Sign in with Google**
- Should open `accounts.google.com` → redirect back to `localhost:5173`
- Create a module → check **Supabase → Table Editor → modules** → should appear

### 4.2 Deploy to Vercel
```bash
git add .
git commit -m "feat: migrate Firebase to Supabase"
git push
```
Vercel auto-deploys on push.

### 4.3 Test in Myanmar (No VPN)
- Open deployed app URL
- Sign in with Google → should work without VPN
- Create module → open in different browser → should sync ✅

---

## Phase 5 — Cleanup
> Only after confirming everything works

```bash
rm api/firebase-admin.js
git add .
git commit -m "chore: remove Firebase remnants after Supabase migration"
git push
```

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Supabase API blocked | `localStorage` fallback keeps data safe |
| Google OAuth redirect fails | Test locally first |
| Something breaks in production | `git revert` anytime |
| Existing Firestore data lost | Users re-import; data was per-user |

---

## What Does NOT Change

- ✅ All quiz features (MCQ, FIB, Matching, True/False, Header)
- ✅ All UI and styling (Tailwind, dark mode, Burmese/English)
- ✅ AI module generation via `/api/parse` with Gemini
- ✅ localStorage fallback (works offline / without login)
- ✅ Folder system, rename, delete
- ✅ Gemini API key saved to cloud
- ✅ Vercel deployment

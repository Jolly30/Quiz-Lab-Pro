# Quiz Lab Pro

Quiz Lab Pro is an intelligent, AI-powered educational exam parser and interactive quiz management application. It allows educators and students to convert unstructured, raw text exams into interactive digital quizzes with real-time scoring, progress tracking, and multi-device synchronization.

---

## Key Features

* **Smart AI Text Parsing**: Integrates with the Google Gemini API (`gemini-2.5-flash-lite`) to parse messy raw text inputs (including multi-line breaks, tables, true/false declarations, and scrambled match lists) into structured JSON data.
* **Support for Diverse Question Types**:
  * **Multiple Choice Questions (MCQ)**: Interactive single-select options with automated letter mapping.
  * **True / False (TF)**: Statement validation with inline options.
  * **Fill-in-the-Blanks (FIB)**: Keyword validation supporting alternative answers (e.g., using "or" or slash separations).
  * **Interactive Matching Column**: A grid column connector that maps terms to their corresponding matches, providing interactive connection lines and detailed correct/incorrect reviews.
  * **Section Headers**: Group and organize questions logically.
* **Hierarchical Organization**: Organize modules using custom folders. Features support to create, rename, expand/collapse, and delete folders and modules.
* **Dual-Language Interface**: Full application localization in **English** and **Myanmar (Burmese)**.
* **Firebase Cloud Sync**: Synchronizes folders, modules, and progress data in real time to Firestore database with Google Authentication. Falls back to offline-first LocalStorage when in local development or offline.
* **Refined Design**: Adaptive dark/light theme, built-in splash screen loader, responsive layouts for mobile and desktop viewports, and custom loading states.
* **Progressive Web App (PWA)**: Built-in support for PWA standalone installation on mobile devices and desktop clients.

---

## Tech Stack

* **Frontend**: React 19, JavaScript (ES6+), Tailwind CSS 3
* **Build System**: Vite 8 (configured with manual chunk splitting for Firebase, React core, and Icons to optimize load times)
* **Database & Auth**: Firebase Auth, Firebase Firestore
* **AI Processing**: Vercel Serverless Function, Google Gemini API
* **Icons**: Lucide React

---

## Prerequisites

* Node.js (v18.x or higher)
* npm (v9.x or higher)
* [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
* A Google account (for Firebase Auth)

### Required API Keys

| Key | Where to Get | Purpose |
|-----|-------------|---------|
| Gemini API Key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | AI text parsing (free tier available) |
| Firebase Service Account | [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts | Server-side token verification |

---

## Quick Start (Clone & Run)

```bash
# 1. Clone the repo
git clone https://github.com/Jolly30/Quiz-Lab-Pro.git
cd Quiz-Lab-Pro

# 2. Install dependencies
npm install

# 3. Install Vercel CLI (required for local API server)
npm i -g vercel

# 4. Create .env file
cp .env.example .env

# 5. Add your Gemini API key to .env
# Edit .env and set: GEMINI_API_KEY=your_key_here

# 6. Start dev server
vercel dev

# 7. Open http://localhost:3000
```

> **Why Vercel CLI?** The app has a `/api/parse` serverless function that calls the Gemini API. Only `vercel dev` can run this — `vite dev` only serves the frontend without the API.

---

## Development Flow

### Local Development

```bash
vercel dev
```

The app runs at `http://localhost:3000`. In local mode:
- Uses **localStorage** for data storage (no Firebase required)
- Gemini API calls go through the local `/api/parse` endpoint
- No Google sign-in needed (works offline-first)

### Firebase Setup (Optional — for Cloud Sync)

If you want multi-device sync and Google sign-in:

1. **Firebase project:** `quiz-lab-pro` (already configured in `src/App.jsx`)
2. **Gemini API Key:** Get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and add to `.env`
3. **Firestore rules:** Set these in Firebase Console → Firestore → Rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/users/{userId}/modules/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /artifacts/{appId}/users/{userId}/settings/{document} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
4. Add your domain to **Authentication → Settings → Authorized domains**:
   - `localhost`
   - `quiz-lab-pro.vercel.app` (your production domain)
5. Generate a **Service Account key** (JSON) from Project Settings → Service Accounts

### Deploy to Production

```bash
# Deploy to Vercel
vercel --prod

# Or push to main branch (auto-deploys)
git push origin main
```

### Set Environment Variables on Vercel

```bash
# Add Gemini API key
vercel env add GEMINI_API_KEY production

# Add Firebase Service Account (paste the JSON as a single line)
cat ~/Downloads/serviceAccount.json | tr -d '\n' | vercel env add FIREBASE_SERVICE_ACCOUNT production
```

---

## Security Architecture

### Authentication Flow

```
User → Google Sign-In → Firebase Auth → ID Token → Server verifies token → Access granted
```

- **Client sends Firebase ID token** (not raw UID) to `/api/parse`
- **Server verifies token** using Firebase Admin SDK
- **No open proxy** — unauthenticated requests are rejected

### API Protection

| Protection | Implementation |
|-----------|---------------|
| **Rate limiting** | 5 requests per minute per IP |
| **Input sanitization** | HTML tags stripped, control chars removed, 100k char limit |
| **Error sanitization** | Generic error messages — no API key or quota details leaked |
| **CSP header** | Content-Security-Policy allows only Firebase/Google domains |

### Data Storage

| Data | Storage | Syncs? |
|------|---------|--------|
| Quiz modules | Firestore + localStorage | ✅ (when signed in) |
| API key | Firestore + localStorage (obfuscated) | ✅ (when signed in) |
| Theme preference | localStorage only | ❌ (device only) |
| Language | localStorage only | ❌ (device only) |

---

## Folder Structure

```text
├── api/
│   ├── firebase-admin.js   # Firebase Admin SDK initialization (dynamic imports)
│   └── parse.js            # Vercel Serverless Function handling Gemini API requests
├── public/
│   ├── file.svg            # Animated splash graphic
│   ├── logo_v2.png         # PWA and app favicon/icon
│   └── manifest.json       # PWA configuration manifest
├── src/
│   ├── App.jsx             # Main React application component
│   ├── index.css           # Tailwind stylesheet
│   └── main.jsx            # React application entry point
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── eslint.config.js        # ESLint configuration
├── index.html              # Entry HTML file
├── package.json            # Dependencies and scripts
├── postcss.config.js       # PostCSS rules for Tailwind
├── tailwind.config.js      # Tailwind utility theme configuration
├── vercel.json             # Vercel deployment and security headers config
└── vite.config.js          # Vite configuration with chunk optimizations
```

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | Server-side only | Google Gemini API key for AI parsing |
| `FIREBASE_SERVICE_ACCOUNT` | Server-side only | Firebase Admin SDK service account JSON (for token verification) |

### .env.example

```
# Server-side only — never exposed to the browser
# Get your key at: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## API Architecture

The application handles text ingestion via a serverless POST endpoint `/api/parse`. It takes a `rawInput` body string and processes it using instructions that enforce structural constraints:

1. **Authentication**: Verifies Firebase ID token, fetches user's private API key from Firestore
2. **Rate Limiting**: 5 requests per minute per IP address
3. **Input Sanitization**: Strips HTML tags, control characters, and enforces a 100k character limit
4. **Chunking**: Segments large inputs into chunks that fit within API token limits
5. **AI Parsing**: Sends instructions to the Google Gemini API to return a strict JSON array matching the specific quiz models (MCQ, FIB, Matching, Header)
6. **Error Handling**: Retries on rate limits (429/503) with exponential backoff, and provides sanitized error messages

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `vercel dev` | Start local dev server (recommended) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |
| `vercel --prod` | Deploy to production |

---

## Troubleshooting

### "Cannot find module firebase-admin"
The `/api/parse` endpoint uses dynamic imports for `firebase-admin`. If it fails, the app falls back to using only the `GEMINI_API_KEY` environment variable.

### Google Sign-In fails on mobile
- Ensure your domain is in Firebase's **Authorized Domains** list
- PWA (Home Screen) uses popup sign-in; mobile browser uses redirect
- Clear browser cache if sign-in was working before

### API key doesn't sync across devices
- Ensure you're signed in with the same Google account on both devices
- Check Firestore security rules allow read/write to `settings` collection
- Check browser console for Firestore permission errors

### 500 error on /api/parse
- Verify `GEMINI_API_KEY` is set in Vercel environment variables
- Check Vercel function logs: `vercel logs --limit 10`
- Ensure the Gemini API key is valid and has quota remaining

---

## Author

Developed by **[Yadanar (Jolly30)](./PROFILE.md)**.

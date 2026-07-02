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

## Getting Started

### Prerequisites

* Node.js (v18.x or higher)
* npm (v9.x or higher)
* [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
* A Google Gemini API key — get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Jolly30/Quiz-Lab-Pro.git
   cd Quiz-Lab-Pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running Locally

Start the development server with Vercel CLI (required for API routes):

```bash
vercel dev
```

Open `http://localhost:3000` in your browser.

> **Note:** Use `vercel dev`, not `vite dev`. The `/api/parse` serverless function requires Vercel's dev server to run.

### Linting

```bash
npm run lint
```

### Production Build

```bash
npm run build
```

The production assets will be generated in the `/dist` directory.

---

## Folder Structure

```text
├── api/
│   └── parse.js         # Vercel Serverless Function handling Gemini API requests
├── public/
│   ├── file.svg         # Animated splash graphic
│   ├── logo_v2.png      # PWA and app favicon/icon
│   └── manifest.json    # PWA configuration manifest
├── src/
│   ├── App.jsx          # Main React application component
│   ├── index.css        # Tailwind stylesheet
│   └── main.jsx         # React application entry point
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
├── eslint.config.js     # ESLint configuration
├── index.html           # Entry HTML file
├── package.json         # Dependencies and scripts
├── postcss.config.js    # PostCSS rules for Tailwind
├── tailwind.config.js   # Tailwind utility theme configuration
├── vercel.json          # Vercel deployment and security headers config
└── vite.config.js       # Vite configuration with chunk optimizations
```

---

## API Architecture

The application handles text ingestion via a serverless POST endpoint `/api/parse`. It takes a `rawInput` body string and processes it using instructions that enforce structural constraints:

1. **Input Sanitization**: Strips HTML tags, control characters, and enforces a 100k character limit.
2. **Chunking**: Segments large inputs into chunks that fit within API token limits.
3. **AI Parsing**: Sends instructions to the Google Gemini API to return a strict JSON array matching the specific quiz models (MCQ, FIB, Matching, Header).
4. **Error Handling**: Retries on rate limits (429/503) with exponential backoff, and provides fallback error messages for malformed output.

---

## Security

* **API keys are server-side only** — the Gemini key is never exposed in the client bundle.
* **Input sanitization** — all user input is sanitized before being sent to the AI.
* **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` are configured via `vercel.json`.
* **localStorage encryption** — user API keys stored locally are obfuscated (not plaintext).

---

## Environment Variables

| Variable | Where Used | Description |
|---|---|---|
| `GEMINI_API_KEY` | Server-side only | Google Gemini API key for AI parsing |

Get your key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

For production, set this variable in your [Vercel dashboard](https://vercel.com/dashboard) under **Settings → Environment Variables**.

---

## Author

Developed by **[Yadanar (Jolly30)](./PROFILE.md)**.

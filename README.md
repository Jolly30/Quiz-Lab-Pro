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

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd my-quiz-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the local environment variables. Create a `.env.local` file in the root directory and configure the following keys:
   ```env
   # Gemini API Key for serverless parsing
   GEMINI_API_KEY=your_gemini_api_key_here

   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### Running Locally

* To start the local development server (supports both React frontend and Vercel `/api` backend routes):
  ```bash
  npx vercel dev
  ```
  Open `http://localhost:3000` in your browser.

* To run linting checks:
  ```bash
  npm run lint
  ```

### Production Build

* To compile and bundle the application for production:
  ```bash
  npm run build
  ```
  The production assets will be generated in the `/dist` directory.

* To preview the production bundle locally:
  ```bash
  npm run preview
  ```

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
│   ├── assets/          # Static local assets
│   ├── App.jsx          # Main React application component
│   ├── index.css        # Tailwind stylesheet
│   └── main.jsx         # React application entry point
├── eslint.config.js     # ESLint configuration
├── postcss.config.js    # PostCSS rules for Tailwind
├── tailwind.config.js   # Tailwind utility theme configuration
└── vite.config.js       # Vite configuration with chunk optimizations
```

---

## API Architecture

The application handles text ingestion via a serverless POST endpoint `/api/parse`. It takes a `rawInput` body string and processes it using instructions that enforce structural constraints:
1. Validates input formatting and segments chunks when inputs exceed token thresholds.
2. Directs the Google Gemini API to return a strict JSON array matching the specific quiz models (MCQ, FIB, Matching, Header).
3. Provides fallback error handling for API limits or malformed output parsing.

---

## Author

Developed by **[Yadanar (Jolly30)](./PROFILE.md)**.


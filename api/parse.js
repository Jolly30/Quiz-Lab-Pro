/* global process */
export const maxDuration = 60; // Vercel Node.js timeout allowance

// --- Simple in-memory rate limiter (per-deployment, per-IP) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 5;           // 5 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}, 300000);

// --- CORS helper ---
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- Rate limiting ---
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  try {
    const { rawInput, idToken } = req.body;

    // --- Resolve API key from server env ---
    let apiKey = process.env.GEMINI_API_KEY;

    // --- Dynamically import firebase-admin ---
    let db = null;
    let auth = null;
    try {
      const firebaseAdmin = await import('./firebase-admin.js');
      db = firebaseAdmin.db;
      auth = firebaseAdmin.auth;
    } catch (importErr) {
      // Firebase Admin not available — continue with env key only
    }

    // --- Verify the user's identity with Firebase Admin ---
    let uid = null;
    if (idToken && auth) {
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        uid = decodedToken.uid;
      } catch (err) {
        console.warn('Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired authentication. Please sign in again.' });
      }
    }

    // --- Fetch user's private API key from Firestore (if authenticated) ---
    if (uid && db) {
      try {
        const docSnap = await db.doc(`artifacts/quiz-lab-pro/users/${uid}/settings/apiKeys`).get();
        if (docSnap.exists() && docSnap.data().geminiKey) {
          // Decode the key (XOR + base64) using Buffer for Node.js
          const encKey = 'QLP';
          const decoded = Buffer.from(docSnap.data().geminiKey, 'base64').toString('binary');
          apiKey = [...decoded].map((c, i) =>
            String.fromCharCode(c.charCodeAt(0) ^ encKey.charCodeAt(i % encKey.length))
          ).join('');
        }
      } catch (err) {
        console.warn('Firestore key lookup failed:', err.message);
      }
    }

    // --- Require a valid API key ---
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key available. Please sign in or add a private key in Settings.' });
    }

    // --- Input validation & sanitization ---
    if (!rawInput || typeof rawInput !== 'string') {
      return res.status(400).json({ error: 'Invalid input: raw text is required.' });
    }

    const sanitizedInput = rawInput
      .replace(/<[^>]*>/g, '')        // strip HTML tags
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')  // strip control chars
      .trim()
      .slice(0, 100000);              // cap at 100k chars

    if (sanitizedInput.length === 0) {
      return res.status(400).json({ error: 'Input text is empty after sanitization.' });
    }

    const systemPrompt = `
You are a strict JSON parser for educational exams. Convert raw text into a structured JSON array.

CRITICAL PARSING RULES:
1. IGNORE SEMICOLONS: Semicolons (;), colons (:), and line breaks (\\n) DO NOT mean a question has ended. NEVER split a sentence just because it contains a semicolon.
2. EMOJI FIX: Treat pointing emojis (👉) exactly like the word "Answer:".
3. THE INDEX LOCK (STRICT ORDER): You MUST build the colB array based strictly on the alphabetical labels (A, B, C, D) in the raw text.
   - colB index 0 MUST be the text labeled "A".
   - colB index 1 MUST be the text labeled "B".
   - colB index 2 MUST be the text labeled "C".
   - colB index 3 MUST be the text labeled "D".
   NEVER rearrange colB to match the answer key. If the key says "1-B", you map "0": 1 in correctMatches. NEVER move the "B" text to index 0.
4. NO SKIPPING: You must process every single line of the raw text. Even if a question seems redundant, you MUST output a JSON object for it. Never skip a question number (like 7).
5. NO TEXT MODIFICATION: You MUST use the exact vocabulary provided in the raw text. Never "correct" spellings, technical terms, or names. If the user writes "Lux", do not change it to "Flux". Preserve every word exactly as it appears.
6. HANDLE MESSY FORMATTING (MERGED & MISSING NUMBERS): You must detect when a new question starts even if the formatting is broken.
[Format 1 - Merged]: "13. [Text] Ans: False 14. [Text] Ans: True" -> Split into two objects.
[Format 2 - Missing Number]: "Answer: False \\n A circuit breaker... Answer: True" -> Recognize the text after the first "Answer:" as a completely new question. Automatically assign it the next logical number (e.g., 14) and create a separate JSON object.

CRITICAL EXAMPLES:

EXAMPLE 1: MERGING BROKEN BLANKS (FIB)
If a sentence breaks across lines, you MUST combine them into one string.
{ "type": "fib", "q_num": 1, "question": "where 'P' represents _________;", "answerText": "mean indicated pressure" }

EXAMPLE 2: EXTRACTING EVERY MATCHING ITEM
Never stop a Matching table early due to spaces. Extract every item until the "Ans." key.

EXAMPLE 3: STRIP HEADERS, LETTERS, AND ENFORCE 0-BASED MATCHING
Ignore table headers (e.g., "Term", "Match", "Cause", "Effect"). Strip the letters (A., B., C.) from Column B. The \`correctMatches\` object MUST use 0-based array integers based on the Answer Key, NEVER letters.

EXAMPLE 4: STRICT ANSWER KEY ENFORCEMENT & THE "3-D" TRAP
If you see a Matching question where the Term and the Match are on the same line (e.g., "1. Term   A. Match"), DO NOT assume they pair together. You MUST look at the "Answers:" at the bottom of the set.
CRITICAL: If the key says "3-D", it means "Item 3 maps to Option D". It DOES NOT mean "three-dimensional". You must map index 2 to Option D.

EXAMPLE 5: TRUE/FALSE HANDLING
If you see a statement followed by "True", "False", "(True)", or "(False)", convert it into an MCQ with two options: ["True", "False"].

EXAMPLE 6: VERTICAL STACKED MATCHING
Sometimes matching lists are stacked vertically rather than side-by-side. If you see stray headers like "A" and "B" above a list of terms, ignore those stray letters. Group the unlettered items into colA, and the lettered items (A., B., C.) into colB.

EXAMPLE 7: CATCH ALL SECTION HEADERS AND TITLES
If you see standalone text that acts as a section title, instructions, or category heading (e.g., "Section C: Sentence Matching", "5. Fill in the blank"), you MUST output it as a header object. NEVER ignore section titles.

EXAMPLE 8: INVISIBLE TABLES (INTERLEAVED LISTS)
When a 2-column table is copied as text, it often pastes in a zigzag pattern: Numbered item, then Lettered item, Numbered item, then Lettered item.
[RAW TEXT SEEN]:
1. Collision Bulkhead
A. Reduces liquid sloshing
2. Swash Bulkhead
B. Protects against bow impact
Answers: 1 -> B, 2 -> A
[CORRECT BEHAVIOR]:
Pull all numbered items into colA. Pull all lettered items into colB EXACTLY as they appear (A first, then B). Map them using the Answer Key.
[CORRECT JSON OUTPUT]:
{"type": "matching", "q_num": 1, "question": "Match the following", "colA": [{"text": "Collision Bulkhead"}, {"text": "Swash Bulkhead"}], "colB": [{"text": "Reduces liquid sloshing"}, {"text": "Protects against bow impact"}], "correctMatches": {"0": 1, "1": 0}}

EXAMPLE 9: SCRAMBLED LABELS IN MATCHING
If Column A uses letters (A, B, C) and Column B uses numbers (1, 2, 3) that are scrambled or out of order, trace the exact label used in the Answer Key. DO NOT convert numbers to letters (e.g., do not assume "3" means "C").
[RAW TEXT]:
A. Test run pump         3. Every Saturday
B. Check fuel oil level  1. Ensure pump has enough fuel
Answers: A-3, B-1
[CORRECT BEHAVIOR]:
"A-3" means item "A" maps to the text labeled "3" ("Every Saturday").
"B-1" means item "B" maps to the text labeled "1" ("Ensure pump has enough fuel").
Find those extracted strings in your colB array and use their actual 0-based integer positions to build the correctMatches object.

REQUIRED JSON FORMATS:
MCQ: {"type": "mcq", "q_num": 1, "question": "text", "options": ["A", "B"], "correctAnswerIndex": 0}
FIB: {"type": "fib", "q_num": 2, "question": "text", "answerText": "answer"}
MATCHING: {"type": "matching", "q_num": 3, "question": "Match", "colA": [{"text":"item 1"}], "colB": [{"text":"match A"}], "correctMatches": {"0":1}}
HEADER: {"type": "header", "q_num": 4, "text": "Section title"}

OUTPUT RULES:
Return ONLY a raw, valid JSON array. Do not wrap in \`\`\`json blockticks. No markdown.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: systemPrompt + "\n\nRaw Text to Parse:\n" + sanitizedInput }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      // Sanitize error — never leak API key details or internal errors
      if (response.status === 429) {
        return res.status(429).json({ error: 'AI service is busy. Please wait a minute and try again.' });
      }
      return res.status(503).json({ error: 'AI service is temporarily unavailable. Please try again.' });
    }

    const data = await response.json();

    try {
      // Defensive check for Gemini response structure
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
        return res.status(500).json({ error: 'Invalid AI response format. Please try again.' });
      }

      const rawAiText = data.candidates[0].content.parts[0].text;
      if (!rawAiText) {
        return res.status(500).json({ error: 'AI returned empty response. Please try again.' });
      }

      const cleanJsonString = rawAiText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedContent = JSON.parse(cleanJsonString);

      return res.status(200).json(parsedContent);

    } catch (parseError) {
      return res.status(500).json({ error: 'AI returned invalid JSON format. Please try again.' });
    }

  } catch (error) {
    // Never leak internal error details
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

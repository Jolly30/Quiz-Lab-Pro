export const maxDuration = 60; // Vercel Node.js timeout allowance

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { rawInput, userCustomKey } = req.body;
    const apiKey = userCustomKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'No API Key available.' });
    }

  const systemPrompt = `
You are a strict JSON parser for educational exams. Convert raw text into a structured JSON array.

CRITICAL PARSING RULES:
1. IGNORE SEMICOLONS: Semicolons (;), colons (:), and line breaks (\\n) DO NOT mean a question has ended. NEVER split a sentence just because it contains a semicolon.
2. EMOJI FIX: Treat pointing emojis (👉) exactly like the word "Answer:".
3. STRICT ORIGINAL ORDER: You MUST extract items for colA and colB in the EXACT physical order they appear in the raw text (A, B, C, D). NEVER reorder, alphabetize, or sort colB to match the Answer Key sequence.
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

    console.log("========== PARSE REQUEST STARTED ==========");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ text: systemPrompt + "\n\nRaw Text to Parse:\n" + rawInput }] 
          }],
          generationConfig: {
            responseMimeType: "application/json", 
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || `Google API Error: ${response.status}`;
      console.log(`❌ AI Request Failed: ${errorMessage}`);
      return res.status(response.status === 429 ? 429 : 503).json({ error: errorMessage });
    }

    const data = await response.json();
    
    try {
      const rawAiText = data.candidates[0].content.parts[0].text;
      const cleanJsonString = rawAiText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedContent = JSON.parse(cleanJsonString);

      console.log(`✅ SUCCESS! Parsed ${parsedContent.length} items.`);
      return res.status(200).json(parsedContent);
      
    } catch (parseError) {
      console.error("JSON PARSE ERROR:", parseError);
      return res.status(500).json({ error: "AI returned invalid JSON format. Please try again." });
    }

  } catch (error) {
    console.error("FATAL SERVER ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
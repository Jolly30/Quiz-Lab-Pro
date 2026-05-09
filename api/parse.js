export const maxDuration = 60; // Vercel Node.js timeout allowance

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { rawInput, userCustomKey } = req.body;
    const apiKey = userCustomKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'No API Key available.' });
    }

    // 2. The Instruction Set (The Anti-Splitting System Prompt)
    // 2. The Instruction Set (Few-Shot System Prompt)
    const systemPrompt = `
You are a strict JSON parser for educational exams. Convert raw text into a structured JSON array.

CRITICAL ANTI-SPLITTING RULES:
1. IGNORE SEMICOLONS: Semicolons (;), colons (:), and line breaks (\\n) DO NOT mean a question has ended. NEVER split a sentence just because it contains a semicolon.
2. EMOJI FIX: Treat pointing emojis (👉) exactly like the word "Answer:".

CRITICAL EXAMPLES (YOU MUST MIMIC THIS BEHAVIOR):

EXAMPLE 1: MERGING BROKEN BLANKS (FIB)
If a sentence breaks across lines, you MUST combine them into one string.
[RAW TEXT SEEN]:
"where 'P' represents"
"_________; (Ans. mean indicated pressure)"
[CORRECT JSON OUTPUT]: 
{ "type": "fib", "q_num": 1, "question": "where 'P' represents _________;", "answerText": "mean indicated pressure" }

EXAMPLE 2: EXTRACTING EVERY MATCHING ITEM
Never stop a Matching table early due to spaces. Extract every item until the "Ans." key.
[RAW TEXT SEEN]:
3. Obstructed sampling pipe.    C. Automatic alarm
4. Accumulation of products.    D. Differential check
Ans. 1-C 2-D 3-A 4-B
[CORRECT BEHAVIOR]: 
You MUST include item 4 in colA and item D in colB! Do not stop at item 3.

EXAMPLE 3: STRIP HEADERS AND LETTERS
[RAW TEXT SEEN]:
Cause    Effect
1. Oil mist    A. False negative
[CORRECT BEHAVIOR]:
Ignore the words "Cause" and "Effect". Strip "A." so the colB text is just "False negative".

REQUIRED JSON FORMATS TO OUTPUT:
MCQ: {"type": "mcq", "q_num": 1, "question": "text", "options": ["A", "B"], "correctAnswerIndex": 0}
FIB: {"type": "fib", "q_num": 2, "question": "text", "answerText": "answer"}
MATCHING: {"type": "matching", "q_num": 3, "question": "Match", "colA": [{"text":"item 1"}], "colB": [{"text":"match A"}], "correctMatches": {"0":1}}
HEADER: {"type": "header", "q_num": 4, "text": "Section title"}

EXAMPLE 4: STRICT ANSWER KEY ENFORCEMENT
If you see a Matching question where the Term and the Match are on the same line (e.g., "1. Term   A. Match"), DO NOT assume they pair together. You MUST look at the "Answers:" or "Answer Key:" at the bottom of the set. Only use the explicit mapping provided in the Answer Key (e.g., if the key says "1 -> B", then the first term matches the second option) to build the \`correctMatches\` object.

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
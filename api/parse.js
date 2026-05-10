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

EXAMPLE 3: STRIP HEADERS, LETTERS, AND ENFORCE 0-BASED MATCHING
Ignore table headers (e.g., "Term", "Match", "Cause", "Effect"). Strip the letters (A., B., C.) from Column B. Furthermore, the \`correctMatches\` object MUST use 0-based array integers based on the Answer Key, NEVER letters.
[RAW TEXT SEEN]:
Cause           Effect
1. Oil mist     A. False negative
2. Overheat     B. Alarm sounds
Answers: 1 -> B, 2 -> A
[CORRECT BEHAVIOR]:
Ignore "Cause" and "Effect". Strip "A." and "B.". ColA index 0 is "Oil mist". ColB index 1 is "Alarm sounds". The key says 1 -> B, so "0" maps to 1.
[CORRECT JSON OUTPUT]:
{ "type": "matching", "q_num": 1, "question": "Match the following", "colA": [{"text": "Oil mist"}, {"text": "Overheat"}], "colB": [{"text": "False negative"}, {"text": "Alarm sounds"}], "correctMatches": {"0": 1, "1": 0} }

EXAMPLE 4: STRICT ANSWER KEY ENFORCEMENT & THE "3-D" TRAP
If you see a Matching question where the Term and the Match are on the same line (e.g., "1. Term   A. Match"), DO NOT assume they pair together. You MUST look at the "Answers:" or "Answer Key:" at the bottom of the set. Only use the explicit mapping provided in the Answer Key (e.g., if the key says "1 -> B", then the first term matches the second option) to build the \`correctMatches\` object.
CRITICAL: If the key says "3-D", it means "Item 3 maps to Option D". It DOES NOT mean "three-dimensional". You must map index 2 to Option D.

EXAMPLE 5: TRUE/FALSE HANDLING
If you see a statement followed by "True", "False", "(True)", or "(False)", convert it into an MCQ with two options: "True" and "False". Strip the answer out of the question text. Note: Sometimes the word True/False gets stuck in the middle of the text due to bad formatting (e.g., "...hogging and True sagging."). Fix the sentence and extract the answer.
[RAW TEXT SEEN]: 
"Freeboard is a luxury and not a statutory requirement. False"
[CORRECT JSON OUTPUT]:
{"type": "mcq", "q_num": 4, "question": "Freeboard is a luxury and not a statutory requirement.", "options": ["True", "False"], "correctAnswerIndex": 1}

REQUIRED JSON FORMATS TO OUTPUT:
MCQ: {"type": "mcq", "q_num": 1, "question": "text", "options": ["A", "B"], "correctAnswerIndex": 0}
FIB: {"type": "fib", "q_num": 2, "question": "text", "answerText": "answer"}
MATCHING: {"type": "matching", "q_num": 3, "question": "Match", "colA": [{"text":"item 1"}], "colB": [{"text":"match A"}], "correctMatches": {"0":1}}
HEADER: {"type": "header", "q_num": 4, "text": "Section title"}

EXAMPLE 6: VERTICAL STACKED MATCHING
Sometimes matching lists are stacked vertically rather than side-by-side. If you see stray headers like "A" and "B" above a list of terms, ignore those stray letters. Group the unlettered items into colA, and the lettered items (A., B., C.) into colB.
[RAW TEXT SEEN]:
Match the term:
A
B
Double Bottom
Frame
A. Prevents water entry
B. Transverse support
Answer Key
1 -> B
2 -> A
[CORRECT BEHAVIOR]:
Ignore the stray "A" and "B" at the top. Strip "A." and "B." from the second list. Map Double Bottom to Transverse support (1->B means index 0 maps to index 1).
[CORRECT JSON OUTPUT]:
{"type": "matching", "q_num": 1, "question": "Match the term:", "colA": [{"text": "Double Bottom"}, {"text": "Frame"}], "colB": [{"text": "Prevents water entry"}, {"text": "Transverse support"}], "correctMatches": {"0": 1, "1": 0}}
OUTPUT RULES:
Return ONLY a raw, valid JSON array. Do not wrap in \`\`\`json blockticks. No markdown.

EXAMPLE 7: CATCH ALL SECTION HEADERS AND TITLES
If you see standalone text that acts as a section title, instructions, or category heading (e.g., "Section A: True or False", "Section B: Choose the correct option", "Section C: Sentence Matching", "5. Fill in the blank"), you MUST output it as a header object. NEVER ignore section titles.
[RAW TEXT SEEN]:
"Section A: Indicate whether the following statements are True (T) or False (F)."
"Displacement is the total weight of the ship. True"
[CORRECT JSON OUTPUT]:
[
  {"type": "header", "q_num": 0, "text": "Section A: Indicate whether the following statements are True (T) or False (F)."},
  {"type": "mcq", "q_num": 1, "question": "Displacement is the total weight of the ship.", "options": ["True", "False"], "correctAnswerIndex": 0}
]



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
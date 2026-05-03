// api/parse.js
export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { rawInput } = req.body;
    
    // 2. Grab the secret key from Vercel's secure environment
    // Note: On the backend, we don't need the VITE_ prefix.
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return res.status(500).json({ error: 'Server API Key is missing.' });
    }

    const systemPrompt = `
      You are a strict data parser for a marine engineering quiz app. 
      I will provide raw, messy text from a PDF exam. Convert it into a clean JSON array.
      
      Rules:
      1. Output ONLY a valid JSON array. No markdown formatting, no \`\`\`json wrappers, no text outside the array.
      2. Recognize Section Headers (type: "header", text: "Section Name").
      3. Recognize Multiple Choice (type: "mcq", question: "...", options: ["A) ...", "B) ..."], correctAnswerIndex: 0).
      4. Recognize True/False (type: "tf", question: "...", options: ["True", "False"], correctAnswerIndex: 0).
      5. Recognize Fill-in-the-Blank (type: "fib", question: "...", answerText: "exact answer").
      6. Recognize Matching Sets (type: "matching", question: "...", colA: [{id: "1", text: "..."}], colB: [{letter: "A", text: "..."}], correctMatches: {"0": 1, "1": 2} where keys are colA indexes and values are colB indexes).
      7. Ignore image placeholders entirely. If a question relies on an image, format it as a fill-in-the-blank if you can extract the answer.
    `;

    // 3. Make the API request to Gemini 2.5 Flash from the Vercel Server
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + rawInput }] }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 4. Send the clean JSON back to your React app
    res.status(200).json(data);

  } catch (error) {
    console.error("Vercel Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI } = require("@google/genai");

// ------------------------------
// Setup Express
// ------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// Env Vars
// ------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

// Supabase (SERVICE ROLE key for writes)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Gemini client (new SDK)
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Choose a default Gemini model name.
// You can also store this in the judge.model_name column if you want.
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"; // or "gemini-2.5-pro"

// ------------------------------
// Helper: build LLM prompt
// ------------------------------
function buildPrompt(systemPrompt, questionText, choice, reasoning) {
  return `
SYSTEM:
${systemPrompt}

USER:
Question: ${questionText}
Choice: ${choice ?? "N/A"}
Reasoning: ${reasoning ?? "N/A"}

Return JSON exactly in this format:
{
  "verdict": "pass" | "fail" | "inconclusive",
  "reasoning": "short explanation"
}
`;
}

// ------------------------------
// POST /api/run-judges
// ------------------------------
app.post("/api/run-judges", async (req, res) => {
  const { queueId } = req.body;

  if (!queueId) {
    return res.status(400).json({ error: "Missing queueId" });
  }

  try {
    // 1. Fetch submissions
    const { data: submissions, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("queue_id", queueId);

    if (subErr) throw subErr;

    // 2. Fetch questions
    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("*")
      .eq("queue_id", queueId);

    if (qErr) throw qErr;

    // 3. Fetch answers for those submissions
    const subIds = submissions.map((s) => s.id);
    let answers = [];
    if (subIds.length > 0) {
      const { data, error: ansErr } = await supabase
        .from("answers")
        .select("*")
        .in("submission_id", subIds);
      if (ansErr) throw ansErr;
      answers = data;
    }

    // 4. Fetch judge assignments with judge info
    const { data: qj, error: qjErr } = await supabase
      .from("question_judges")
      .select(
        `
        id,
        question_id,
        judge_id,
        judges(*)
      `
      )
      .eq("queue_id", queueId);

    if (qjErr) throw qjErr;

    let planned = 0;
    let completed = 0;
    let failed = 0;

    // ------------------------------
    // LOOP through evaluation plan
    // ------------------------------
    for (const submission of submissions) {
      for (const question of questions) {
        const assigned = qj.filter((x) => x.question_id === question.id);

        const ans = answers.find(
          (a) =>
            a.submission_id === submission.id &&
            a.question_id === question.id
        );

        if (!ans) continue;

        for (const assignment of assigned) {
          const judge = assignment.judges;
          if (!judge || judge.active === false) continue;

          planned++;

          const prompt = buildPrompt(
            judge.system_prompt,
            question.question_text,
            ans.choice,
            ans.reasoning
          );

          try {
            // Use model from DB if present, otherwise default
            const modelName = judge.model_name || DEFAULT_GEMINI_MODEL;

            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                    role: "user",
                    parts: [{ text: prompt }],
                    },
                ],
            });

            const raw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!raw) {
                console.log("Empty Gemini response:", response);
                failed++;
                continue;
            }

            // Sanitize gemini input
            
            const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

            let verdictJson;
            try {
                verdictJson = JSON.parse(cleaned);
            } catch (err) {
                console.log("Failed to parse LLM JSON:", cleaned);
                failed++;
                continue;
            }

            const { verdict, reasoning } = verdictJson;

            // Optional safety check
            if (!verdict || !reasoning) {
                console.log("Invalid verdict payload:", verdictJson);
                failed++;
                continue;
            }

            const { error: insErr } = await supabase
              .from("evaluations")
              .insert({
                submission_id: submission.id,
                question_id: question.id,
                judge_id: judge.id,
                verdict,
                reasoning,
                created_at: new Date().toISOString(),
              });

            if (insErr) throw insErr;

            completed++;
          } catch (err) {
            console.error("Gemini error:", err);
            failed++;
          }
        }
      }
    }

    return res.json({ planned, completed, failed });
  } catch (err) {
    console.error("RUN JUDGES ERROR:", err);
    return res
      .status(500)
      .json({ error: "Internal error running judges" });
  }
});

app.get("/", (req, res) => {
  res.send("AI Judge backend is running (Gemini)");
});

// ------------------------------
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

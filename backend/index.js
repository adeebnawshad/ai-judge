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

// Default Gemini model if judge.model_name is missing
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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
// Helper: classify Gemini error (for better messages)
// ------------------------------
function classifyGeminiError(err) {
  const msg = String(err?.message || err || "").toLowerCase();

  if (msg.includes("quota") || msg.includes("rate limit")) {
    return "LLM quota or rate limit exceeded.";
  }
  if (msg.includes("permission") || msg.includes("unauthorized")) {
    return "LLM credentials or permissions issue.";
  }
  if (msg.includes("deadline") || msg.includes("timeout")) {
    return "LLM request timed out.";
  }

  return "LLM call failed.";
}

// ------------------------------
// POST /api/run-judges
// ------------------------------
app.post("/api/run-judges", async (req, res) => {
  const { queueId } = req.body;

  if (!queueId) {
    return res.status(400).json({ error: "Missing queueId" });
  }

  console.log(`Running judges for queue: ${queueId}`);

  try {
    // 1. Fetch submissions
    const { data: submissionsData, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("queue_id", queueId);

    if (subErr) {
      console.error("Supabase submissions error:", subErr);
      throw subErr;
    }

    const submissions = submissionsData || [];

    // 2. Fetch questions
    const { data: questionsData, error: qErr } = await supabase
      .from("questions")
      .select("*")
      .eq("queue_id", queueId);

    if (qErr) {
      console.error("Supabase questions error:", qErr);
      throw qErr;
    }

    const questions = questionsData || [];

    // 3. Fetch answers for those submissions
    const subIds = submissions.map((s) => s.id);
    let answers = [];

    if (subIds.length > 0) {
      const { data: answersData, error: ansErr } = await supabase
        .from("answers")
        .select("*")
        .in("submission_id", subIds);

      if (ansErr) {
        console.error("Supabase answers error:", ansErr);
        throw ansErr;
      }

      answers = answersData || [];
    }

    // 4. Fetch judge assignments with judge info
    const { data: qjData, error: qjErr } = await supabase
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

    if (qjErr) {
      console.error("Supabase question_judges error:", qjErr);
      throw qjErr;
    }

    const qj = qjData || [];

    // If nothing to do, short-circuit with a clean response
    if (submissions.length === 0 || questions.length === 0 || qj.length === 0) {
      console.log(
        "No evaluations planned: submissions:",
        submissions.length,
        "questions:",
        questions.length,
        "assignments:",
        qj.length
      );
      return res.json({
        planned: 0,
        completed: 0,
        failed: 0,
        note:
          "Nothing to evaluate: ensure submissions, questions, and judge assignments exist for this queue.",
        warnings: [],
      });
    }

    let planned = 0;
    let completed = 0;
    let failed = 0;
    const runWarnings = new Set();

    // ------------------------------
    // LOOP through evaluation plan
    // ------------------------------
    for (const submission of submissions) {
      for (const question of questions) {
        const assigned = qj.filter((x) => x.question_id === question.id);

        // Find the answer matching this submission + question
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

            const raw =
              response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!raw) {
              console.log("Empty Gemini response:", response);
              failed++;
              runWarnings.add(
                "Received an empty response from the LLM for at least one evaluation."
              );
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
              runWarnings.add(
                "At least one LLM response could not be parsed as JSON."
              );
              continue;
            }

            const { verdict, reasoning } = verdictJson;

            if (!verdict || !reasoning) {
              console.log("Invalid verdict payload:", verdictJson);
              failed++;
              runWarnings.add(
                "At least one LLM response did not include a valid verdict or reasoning."
              );
              continue;
            }

            const { error: insErr } = await supabase.from("evaluations").insert({
              submission_id: submission.id,
              question_id: question.id,
              judge_id: judge.id,
              verdict,
              reasoning,
              created_at: new Date().toISOString(),
            });

            if (insErr) {
              console.error("Supabase insert error (evaluations):", insErr);
              failed++;
              runWarnings.add(
                "At least one evaluation could not be saved to the database."
              );
              continue;
            }

            completed++;
          } catch (err) {
            console.error("Gemini error:", err);
            failed++;

            const msg = String(err?.message || err || "").toLowerCase();

            if (
              err?.status === 429 ||
              msg.includes("quota") ||
              msg.includes("rate limit") ||
              msg.includes("resource_exhausted")
            ) {
              runWarnings.add(
                "LLM quota or rate limit exceeded. Some evaluations were skipped."
              );
            } else {
              runWarnings.add(
                "One or more LLM calls failed. Check backend logs for details."
              );
            }
          }
        }
      }
    }

    console.log(
      `Run complete for queue ${queueId}: planned=${planned}, completed=${completed}, failed=${failed}`
    );

    return res.json({
      planned,
      completed,
      failed,
      warnings: Array.from(runWarnings),
    });
  } catch (err) {
    console.error("RUN JUDGES ERROR:", err);

    // Try to provide a more helpful message for LLM-related errors
    const llmHint = classifyGeminiError(err);

    return res.status(500).json({
      error: "Internal error running judges",
      hint: llmHint,
    });
  }
});

// Simple health check
app.get("/", (req, res) => {
  res.send("AI Judge backend is running (Gemini)");
});

// ------------------------------
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

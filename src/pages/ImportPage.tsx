import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type RawQuestion = {
  rev: number;
  data: {
    id: string;
    questionType: string;
    questionText: string;
  };
};

type RawSubmission = {
  id: string;
  queueId: string;
  labelingTaskId: string;
  createdAt: number;
  questions: RawQuestion[];
  answers: Record<string, { choice?: string; reasoning?: string }>;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

  async function handleImport() {
    if (!file) {
        setStatus("Please select a JSON file first.");
        return;
    }
    
    try {
        setStatus("Reading file...");
        const text = await file.text();
        const data = JSON.parse(text) as RawSubmission[];

        setStatus("Importing into Supabase...");

        let submissionCount = 0;
        let questionCount = 0;
        let answerCount = 0;

        for (const submission of data) {
            const queueId = submission.queueId;

            // 1) Upsert queue
            {
                const { error } = await supabase.from("queues").upsert(
                {
                    id: queueId,
                    name: queueId, // you can improve this later
                },
                { onConflict: "id" }
                );
                if (error) throw error;
            }

            // 2) Insert submission (upsert in case we re-import same file)
            {
                const { error } = await supabase.from("submissions").upsert(
                {
                    id: submission.id,
                    queue_id: queueId,
                    labeling_task_id: submission.labelingTaskId,
                    created_at: submission.createdAt,
                },
                { onConflict: "id" }
                );
                if (error) throw error;
            }
            submissionCount++;

            // 3) Upsert questions
            for (const q of submission.questions) {
                const { error } = await supabase.from("questions").upsert(
                {
                    id: q.data.id,
                    queue_id: queueId,
                    question_type: q.data.questionType,
                    question_text: q.data.questionText,
                },
                { onConflict: "id" }
                );
                if (error) throw error;
                questionCount++;
            }

            // 4) Insert answers
            for (const [questionId, answer] of Object.entries(submission.answers)) {
                const { error } = await supabase.from("answers").insert({
                submission_id: submission.id,
                question_id: questionId,
                choice: answer.choice ?? null,
                reasoning: answer.reasoning ?? null,
                raw_answer: null,
                });
                if (error) throw error;
                answerCount++;
            }
        }

        setStatus(
            `Imported ${submissionCount} submissions, ${questionCount} questions, ${answerCount} answers.`
        );
    } catch (err) {
        console.error(err);
        setStatus("Failed to import into Supabase. Check console for details.");
    }
  }


  return (
    <div style={{ padding: "1rem" }}>
      <h1>Import Data</h1>
      <input type="file" accept="application/json" onChange={handleFileChange} />
      <button onClick={handleImport} disabled={!file}>
        Upload &amp; Import
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}

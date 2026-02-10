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

type StatusState =
  | { kind: "idle"; message: "" }
  | { kind: "info"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({
    kind: "idle",
    message: "",
  });
  const [isImporting, setIsImporting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStatus({ kind: "idle", message: "" });
  }

  async function handleImport() {
    if (!file) {
      setStatus({
        kind: "error",
        message: "Please select a JSON file first.",
      });
      return;
    }

    setIsImporting(true);

    try {
      setStatus({ kind: "info", message: "Reading file..." });
      const text = await file.text();

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setStatus({
          kind: "error",
          message: "The selected file is not valid JSON.",
        });
        return;
      }

      if (!Array.isArray(data)) {
        setStatus({
          kind: "error",
          message:
            "Expected a JSON array of submissions. Please double-check the file format.",
        });
        return;
      }

      const submissions = data as RawSubmission[];

      setStatus({ kind: "info", message: "Importing into Supabase..." });

      let submissionCount = 0;
      let questionCount = 0;
      let answerCount = 0;

      for (const submission of submissions) {
        const queueId = submission.queueId;

        // 1) Upsert queue
        {
          const { error } = await supabase.from("queues").upsert(
            {
              id: queueId,
              name: queueId, // can be improved later
            },
            { onConflict: "id" }
          );
          if (error) throw error;
        }

        // 2) Upsert submission
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
        for (const [questionId, answer] of Object.entries(
          submission.answers
        )) {
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

      setStatus({
        kind: "success",
        message: `Imported ${submissionCount} submissions, ${questionCount} questions, ${answerCount} answers.`,
      });
      // optional: keep file selected in case they re-use it; you can clear if you want
      // setFile(null);
    } catch (err) {
      console.error(err);
      setStatus({
        kind: "error",
        message:
          "Failed to import into Supabase. Please check the console for details.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  const isButtonDisabled = !file || isImporting;

  return (
    <section className="page-section">
      <header className="page-header">
        <h1 className="page-title">Import Submissions</h1>
        <p className="page-subtitle">
          Upload a <code>.json</code> file shaped like <code>sample_input.json</code>.
          Submissions, questions, and answers will be persisted to Supabase.
        </p>
      </header>

      <div className="card">
        <div className="card-body card-body-horizontal">
          <div className="card-main">
            <label className="field-label" htmlFor="json-upload">
              JSON file
            </label>
            <input
              id="json-upload"
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <p className="field-help">
                Selected: <span className="field-help-strong">{file.name}</span>
              </p>
            )}
          </div>

          <div className="card-actions">
            <button
              type="button"
              onClick={handleImport}
              disabled={isButtonDisabled}
              className="btn btn-primary"
            >
              {isImporting ? "Importing…" : "Upload & Import"}
            </button>
          </div>
        </div>

        {status.message && (
          <div
            className={`status-banner status-${status.kind}`}
            role={
              status.kind === "error" || status.kind === "success"
                ? "status"
                : undefined
            }
          >
            {status.message}
          </div>
        )}
      </div>
    </section>
  );
}

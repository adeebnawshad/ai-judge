import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Question = {
  id: string;
  queue_id: string;
  question_text: string;
  question_type: string;
};

type Judge = {
  id: string;
  name: string;
  model_name: string;
  active: boolean;
};

type QuestionJudge = {
  id: string;
  queue_id: string;
  question_id: string;
  judge_id: string;
};

type RunJudgesResponse = {
  planned: number;
  completed: number;
  failed: number;
  note?: string;
  warnings?: string[];
  error?: string;
  hint?: string;
};


type RunStatus =
  | { kind: "idle"; message: "" }
  | { kind: "info" | "success" | "error"; message: string };

export default function QueuePage() {
  const { queueId } = useParams<{ queueId: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [questionJudges, setQuestionJudges] = useState<QuestionJudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [runStatus, setRunStatus] = useState<RunStatus>({
    kind: "idle",
    message: "",
  });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!queueId) return;
    void loadData(queueId);
  }, [queueId]);

  async function loadData(qId: string) {
    setLoading(true);
    setError(null);
    setRunStatus({ kind: "idle", message: "" });

    try {
      const [questionsRes, judgesRes, mappingsRes] = await Promise.all([
        supabase
          .from("questions")
          .select("*")
          .eq("queue_id", qId)
          .order("id", { ascending: true }),
        supabase
          .from("judges")
          .select("*")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase.from("question_judges").select("*").eq("queue_id", qId),
      ]);

      if (questionsRes.error) throw questionsRes.error;
      if (judgesRes.error) throw judgesRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      setQuestions((questionsRes.data ?? []) as Question[]);
      setJudges((judgesRes.data ?? []) as Judge[]);
      setQuestionJudges((mappingsRes.data ?? []) as QuestionJudge[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load queue data.");
    } finally {
      setLoading(false);
    }
  }

  function isAssigned(questionId: string, judgeId: string) {
    return questionJudges.some(
      (qj) => qj.question_id === questionId && qj.judge_id === judgeId
    );
  }

  async function handleToggle(
    questionId: string,
    judgeId: string,
    checked: boolean
  ) {
    if (!queueId) return;
    setError(null);
    setRunStatus({ kind: "idle", message: "" });

    if (checked) {
      // Assign: insert into question_judges
      const { data, error } = await supabase
        .from("question_judges")
        .insert({
          queue_id: queueId,
          question_id: questionId,
          judge_id: judgeId,
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        setError("Failed to assign judge to question.");
        return;
      }

      setQuestionJudges((prev) => [...prev, data as QuestionJudge]);
    } else {
      // Unassign: delete from question_judges
      const { error } = await supabase
        .from("question_judges")
        .delete()
        .eq("queue_id", queueId)
        .eq("question_id", questionId)
        .eq("judge_id", judgeId);

      if (error) {
        console.error(error);
        setError("Failed to remove judge from question.");
        return;
      }

      setQuestionJudges((prev) =>
        prev.filter(
          (qj) =>
            !(
              qj.queue_id === queueId &&
              qj.question_id === questionId &&
              qj.judge_id === judgeId
            )
        )
      );
    }
  }

  async function handleRunJudges() {
    if (!queueId) return;

    setError(null);
    setRunStatus({ kind: "idle", message: "" });

    if (questions.length === 0) {
      setRunStatus({
        kind: "error",
        message: "There are no questions in this queue. Import data first.",
      });
      return;
    }

    if (judges.length === 0) {
      setRunStatus({
        kind: "error",
        message: "No active judges found. Create and activate judges first.",
      });
      return;
    }

    if (questionJudges.length === 0) {
      setRunStatus({
        kind: "error",
        message:
          "No judge assignments found. Assign at least one judge to a question before running.",
      });
      return;
    }

    setIsRunning(true);
    setRunStatus({ kind: "info", message: "Running AI judges…" });

    try {
      const res = await fetch("http://localhost:8787/api/run-judges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId }),
      });

      let data: RunJudgesResponse | null = null;
      
      try {
        data = (await res.json()) as RunJudgesResponse;
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.error("Run judges error:", data);

        const backendError =
          (data && typeof data.error === "string" && data.error) ||
          "Failed to run AI judges.";

        const hint =
          data && typeof data.hint === "string" ? data.hint : null;

        setRunStatus({
          kind: "error",
          message: hint ? `${backendError} ${hint}` : backendError,
        });
        return;
      }

      const summary = `Planned: ${data?.planned ?? 0}, Completed: ${
        data?.completed ?? 0
      }, Failed: ${data?.failed ?? 0}`;

      const note =
        data && typeof data.note === "string" ? ` ${data.note}` : "";

      const warnings =
        Array.isArray(data?.warnings) && data.warnings.length > 0
          ? ` Warnings: ${data.warnings.join(" ")}`
          : "";

      setRunStatus({
        kind: data?.warnings?.length ? "error" : "success",
        message: summary + note + warnings,
      });
    } catch (err) {
      console.error(err);
      setRunStatus({
        kind: "error",
        message:
          "Failed to run AI judges. Possible network or backend error — check backend logs.",
      });
    } finally {
      setIsRunning(false);
    }
  }

  if (!queueId) {
    return (
      <section className="page-section">
        <header className="page-header">
          <h1 className="page-title">Queue</h1>
        </header>
        <div className="card">
          <div className="card-body">
            <p className="empty-state">Missing queueId in URL.</p>
          </div>
        </div>
      </section>
    );
  }

  const totalAssignments = questionJudges.length;

  return (
    <section className="page-section">
      <header className="page-header">
        <h1 className="page-title">Queue: {queueId}</h1>
        <p className="page-subtitle">
          Assign active judges to questions. When ready, run the AI judges to create
          evaluation tasks for this queue.
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-body" style={{ gap: "0.75rem" }}>
          {/* Summary */}
          <div className="queue-summary">
            <div className="queue-summary-item">
              <span className="queue-summary-label">Questions</span>
              <span className="queue-summary-value">{questions.length}</span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">Active judges</span>
              <span className="queue-summary-value">{judges.length}</span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">Assignments</span>
              <span className="queue-summary-value">{totalAssignments}</span>
            </div>

            <div className="queue-summary-cta">
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleRunJudges}
                disabled={isRunning || loading}
              >
                {isRunning ? "Running…" : "Run AI Judges"}
              </button>
            </div>
          </div>

          {/* Run status */}
          {runStatus.kind !== "idle" && runStatus.message && (
            <div
              className={`status-banner status-${runStatus.kind}`}
              role="status"
            >
              {runStatus.message}
            </div>
          )}

          {/* Load / error */}
          {error && (
            <div className="status-banner status-error" role="status">
              {error}
            </div>
          )}

          {loading && (
            <p className="empty-state">Loading questions and judges…</p>
          )}

          {!loading && questions.length === 0 && (
            <p className="empty-state">
              No questions found for this queue. Import submissions to populate it.
            </p>
          )}

          {!loading && questions.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Type</th>
                    <th>Judges</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <div className="table-primary">
                          <div className="table-title">{q.question_text}</div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-muted">
                          {q.question_type}
                        </span>
                      </td>
                      <td>
                        {judges.length === 0 ? (
                          <span className="empty-state">
                            No active judges. Create some on the Judges page.
                          </span>
                        ) : (
                          <div className="judge-chips">
                            {judges.map((judge) => (
                              <label key={judge.id} className="judge-chip">
                                <input
                                  type="checkbox"
                                  checked={isAssigned(q.id, judge.id)}
                                  onChange={(e) =>
                                    handleToggle(
                                      q.id,
                                      judge.id,
                                      e.target.checked
                                    )
                                  }
                                />
                                <span>{judge.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

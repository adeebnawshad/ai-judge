import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Submission = {
  id: string;
  queue_id: string;
  labeling_task_id: string | null;
  created_at: string; // stored as timestamp / bigint string in Supabase
};

type Question = {
  id: string;
  queue_id: string;
  question_text: string;
};

type Answer = {
  submission_id: string;
  question_id: string;
  choice: string | null;
  reasoning: string | null;
};

type SubmissionSummary = {
  id: string;
  queueId: string;
  labelingTaskId: string | null;
  createdAt: string;
  questionCount: number;
  answerCount: number;
};

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(
    null
  );

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    setSelectedSubmissionId(null);

    try {
      const [subRes, qRes, aRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("questions")
          .select("id, queue_id, question_text"),
        supabase
          .from("answers")
          .select("submission_id, question_id, choice, reasoning"),
      ]);

      if (subRes.error) throw subRes.error;
      if (qRes.error) throw qRes.error;
      if (aRes.error) throw aRes.error;

      setSubmissions((subRes.data ?? []) as Submission[]);
      setQuestions((qRes.data ?? []) as Question[]);
      setAnswers((aRes.data ?? []) as Answer[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }

  const questionsByQueue = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) {
      map.set(q.queue_id, (map.get(q.queue_id) ?? 0) + 1);
    }
    return map;
  }, [questions]);

  const answersBySubmissionId = useMemo(() => {
    const map = new Map<string, Answer[]>();
    for (const a of answers) {
      const list = map.get(a.submission_id) ?? [];
      list.push(a);
      map.set(a.submission_id, list);
    }
    return map;
  }, [answers]);

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) {
      map.set(q.id, q);
    }
    return map;
  }, [questions]);

  const submissionSummaries: SubmissionSummary[] = useMemo(() => {
    return submissions.map((s) => {
      const submissionAnswers = answersBySubmissionId.get(s.id) ?? [];
      const questionCount = questionsByQueue.get(s.queue_id) ?? 0;

      return {
        id: s.id,
        queueId: s.queue_id,
        labelingTaskId: s.labeling_task_id,
        createdAt: s.created_at,
        questionCount,
        answerCount: submissionAnswers.length,
      };
    });
  }, [submissions, answersBySubmissionId, questionsByQueue]);

  const queueOptions = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => set.add(s.queue_id));
    return Array.from(set).sort();
  }, [submissions]);

  const filteredSummaries = useMemo(() => {
    if (selectedQueueFilter === "all") {
      return submissionSummaries;
    }
    return submissionSummaries.filter(
      (s) => s.queueId === selectedQueueFilter
    );
  }, [submissionSummaries, selectedQueueFilter]);

  const selectedSubmission = useMemo(
    () =>
      selectedSubmissionId
        ? submissions.find((s) => s.id === selectedSubmissionId) ?? null
        : null,
    [selectedSubmissionId, submissions]
  );

  const selectedSubmissionAnswers = useMemo(() => {
    if (!selectedSubmissionId) return [];
    return answersBySubmissionId.get(selectedSubmissionId) ?? [];
  }, [selectedSubmissionId, answersBySubmissionId]);

  return (
    <section className="page-section">
      <header className="page-header">
        <h1 className="page-title">Submissions</h1>
        <p className="page-subtitle">
          Browse imported submissions per queue and inspect the captured answers.
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-body" style={{ gap: "0.75rem" }}>
          {/* Top bar: filters + reload */}
          <div className="queue-summary">
            <div className="queue-summary-item">
              <span className="queue-summary-label">Total submissions</span>
              <span className="queue-summary-value">
                {submissions.length}
              </span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">Queues</span>
              <span className="queue-summary-value">
                {queueOptions.length}
              </span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">Answers</span>
              <span className="queue-summary-value">{answers.length}</span>
            </div>

            <div className="queue-summary-cta" style={{ gap: "0.5rem" }}>
              <select
                className="input"
                value={selectedQueueFilter}
                onChange={(e) => setSelectedQueueFilter(e.target.value)}
              >
                <option value="all">All queues</option>
                {queueOptions.map((qId) => (
                  <option key={qId} value={qId}>
                    {qId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Errors / loading */}
          {error && (
            <div className="status-banner status-error" role="status">
              {error}
            </div>
          )}

          {loading && (
            <p className="empty-state">Loading submissions…</p>
          )}

          {!loading && submissions.length === 0 && (
            <p className="empty-state">
              No submissions found. Try importing a JSON file on the Import page.
            </p>
          )}

          {/* Table */}
          {!loading && filteredSummaries.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th>Queue</th>
                    <th>Labeling Task</th>
                    <th>Questions</th>
                    <th>Answers</th>
                    <th>Created At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="table-primary">
                          <div className="table-title">{s.id}</div>
                        </div>
                      </td>
                      <td>{s.queueId}</td>
                      <td>{s.labelingTaskId ?? "—"}</td>
                      <td>{s.questionCount}</td>
                      <td>{s.answerCount}</td>
                      <td>
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() =>
                            setSelectedSubmissionId((prev) =>
                              prev === s.id ? null : s.id
                            )
                          }
                        >
                          {selectedSubmissionId === s.id
                            ? "Hide answers"
                            : "View answers"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected submission details */}
          {selectedSubmission && (
            <div
              className="card"
              style={{ marginTop: "1rem", backgroundColor: "#111" }}
            >
              <div className="card-body" style={{ gap: "0.5rem" }}>
                <h2 className="section-title">
                  Submission details: {selectedSubmission.id}
                </h2>
                <p className="page-subtitle">
                  Queue <code>{selectedSubmission.queue_id}</code>{" "}
                  {selectedSubmission.labeling_task_id && (
                    <>
                      &middot; Labeling task{" "}
                      <code>{selectedSubmission.labeling_task_id}</code>
                    </>
                  )}
                </p>

                {selectedSubmissionAnswers.length === 0 ? (
                  <p className="empty-state">
                    No answers recorded for this submission.
                  </p>
                ) : (
                  <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Choice</th>
                          <th>Reasoning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSubmissionAnswers.map((a, idx) => {
                          const q = questionsById.get(a.question_id);
                          return (
                            <tr key={`${a.submission_id}-${a.question_id}-${idx}`}>
                              <td>{q?.question_text ?? a.question_id}</td>
                              <td>{a.choice ?? "—"}</td>
                              <td>{a.reasoning ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

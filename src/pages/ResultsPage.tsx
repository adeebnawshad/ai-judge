import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Evaluation = {
  id: string;
  submission_id: string;
  question_id: string;
  judge_id: string;
  verdict: string;
  reasoning: string | null;
  created_at: string;
};

type Question = {
  id: string;
  question_text: string;
};

type Judge = {
  id: string;
  name: string;
};

type EnrichedEvaluation = {
  id: string;
  submissionId: string;
  questionId: string;
  judgeId: string;
  verdict: string;
  reasoning: string | null;
  createdAt: string;
  questionText: string;
  judgeName: string;
};

export default function ResultsPage() {
  const [evaluations, setEvaluations] = useState<EnrichedEvaluation[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedVerdicts, setSelectedVerdicts] = useState<string[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [evalRes, qRes, jRes] = await Promise.all([
        supabase.from("evaluations").select("*").order("created_at", {
          ascending: false,
        }),
        supabase.from("questions").select("id, question_text"),
        supabase.from("judges").select("id, name"),
      ]);

      if (evalRes.error) throw evalRes.error;
      if (qRes.error) throw qRes.error;
      if (jRes.error) throw jRes.error;

      const evalRows = (evalRes.data ?? []) as Evaluation[];
      const questionRows = (qRes.data ?? []) as Question[];
      const judgeRows = (jRes.data ?? []) as Judge[];

      const questionById = new Map<string, Question>();
      questionRows.forEach((q) => questionById.set(q.id, q));

      const judgeById = new Map<string, Judge>();
      judgeRows.forEach((j) => judgeById.set(j.id, j));

      const enriched: EnrichedEvaluation[] = evalRows.map((e) => {
        const q = questionById.get(e.question_id);
        const j = judgeById.get(e.judge_id);

        return {
          id: e.id,
          submissionId: e.submission_id,
          questionId: e.question_id,
          judgeId: e.judge_id,
          verdict: e.verdict,
          reasoning: e.reasoning,
          createdAt: e.created_at,
          questionText: q?.question_text ?? "(unknown question)",
          judgeName: j?.name ?? "(unknown judge)",
        };
      });

      setEvaluations(enriched);
      setQuestions(questionRows);
      setJudges(judgeRows);
    } catch (err) {
      console.error(err);
      setError("Failed to load evaluations.");
    } finally {
      setLoading(false);
    }
  }

  function toggleInArray(current: string[], value: string, checked: boolean) {
    if (checked) {
      if (current.includes(value)) return current;
      return [...current, value];
    } else {
      return current.filter((v) => v !== value);
    }
  }

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((e) => {
      if (
        selectedJudgeIds.length > 0 &&
        !selectedJudgeIds.includes(e.judgeId)
      ) {
        return false;
      }

      if (
        selectedQuestionIds.length > 0 &&
        !selectedQuestionIds.includes(e.questionId)
      ) {
        return false;
      }

      if (
        selectedVerdicts.length > 0 &&
        !selectedVerdicts.includes(e.verdict)
      ) {
        return false;
      }

      return true;
    });
  }, [evaluations, selectedJudgeIds, selectedQuestionIds, selectedVerdicts]);

  const { total, passCount, passRate } = useMemo(() => {
    const total = filteredEvaluations.length;
    const passCount = filteredEvaluations.filter(
      (e) => e.verdict === "pass"
    ).length;
    const passRate = total > 0 ? (passCount / total) * 100 : 0;
    return { total, passCount, passRate };
  }, [filteredEvaluations]);

  function verdictBadgeClass(verdict: string) {
    if (verdict === "pass") return "badge badge-success";
    if (verdict === "fail") return "badge badge-error";
    if (verdict === "inconclusive") return "badge badge-muted";
    return "badge badge-muted";
  }

  function handleClearFilters() {
    setSelectedJudgeIds([]);
    setSelectedQuestionIds([]);
    setSelectedVerdicts([]);
  }

  const hasEvaluations = evaluations.length > 0;
  const hasFiltered = filteredEvaluations.length > 0;

  return (
    <section className="page-section">
      <header className="page-header">
        <h1 className="page-title">Results</h1>
        <p className="page-subtitle">
          Browse stored evaluations with filters by judge, question, and verdict. The
          pass rate updates live as you refine the view.
        </p>
      </header>

      <div className="card">
        <div className="card-body" style={{ gap: "0.9rem" }}>
          {error && (
            <div className="status-banner status-error" role="status">
              {error}
            </div>
          )}

          {loading && (
            <p className="empty-state">Loading evaluations…</p>
          )}

          {/* Summary bar */}
          {!loading && hasEvaluations && (
            <div className="results-summary">
              <div className="results-summary-main">
                <div className="results-summary-label">Pass rate</div>
                <div className="results-summary-value">
                  {total === 0
                    ? "N/A"
                    : `${passRate.toFixed(1)}% pass of ${total} evaluations`}
                </div>
                {total > 0 && (
                  <div className="results-summary-sub">
                    {passCount} pass / {total - passCount} non-pass
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleClearFilters}
                disabled={
                  selectedJudgeIds.length === 0 &&
                  selectedQuestionIds.length === 0 &&
                  selectedVerdicts.length === 0
                }
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Filters */}
          {!loading && hasEvaluations && (
            <div className="filters-card">
              {/* Judges filter */}
              <div className="filter-column">
                <div className="filter-title">Judge</div>
                {judges.length === 0 ? (
                  <p className="empty-state">No judges found.</p>
                ) : (
                  <div className="filter-options">
                    {judges.map((j) => (
                      <label key={j.id} className="filter-option">
                        <input
                          type="checkbox"
                          checked={selectedJudgeIds.includes(j.id)}
                          onChange={(e) =>
                            setSelectedJudgeIds((prev) =>
                              toggleInArray(prev, j.id, e.target.checked)
                            )
                          }
                        />
                        <span>{j.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Questions filter */}
              <div className="filter-column">
                <div className="filter-title">Question</div>
                {questions.length === 0 ? (
                  <p className="empty-state">No questions found.</p>
                ) : (
                  <div className="filter-options filter-options-scroll">
                    {questions.map((q) => (
                      <label key={q.id} className="filter-option">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(q.id)}
                          onChange={(e) =>
                            setSelectedQuestionIds((prev) =>
                              toggleInArray(prev, q.id, e.target.checked)
                            )
                          }
                        />
                        <span>{q.question_text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Verdict filter */}
              <div className="filter-column">
                <div className="filter-title">Verdict</div>
                <div className="filter-options">
                  {["pass", "fail", "inconclusive"].map((v) => (
                    <label key={v} className="filter-option">
                      <input
                        type="checkbox"
                        checked={selectedVerdicts.includes(v)}
                        onChange={(e) =>
                          setSelectedVerdicts((prev) =>
                            toggleInArray(prev, v, e.target.checked)
                          )
                        }
                      />
                      <span className="filter-verdict-label">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty states / table */}
          {!loading && !hasEvaluations && (
            <p className="empty-state">
              No evaluations found yet. Run AI judges on a queue to populate this view.
            </p>
          )}

          {!loading && hasFiltered && (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th>Question</th>
                    <th>Judge</th>
                    <th>Verdict</th>
                    <th>Reasoning</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluations.map((e) => (
                    <tr key={e.id}>
                      <td>{e.submissionId}</td>
                      <td>
                        <div className="table-primary">
                          <div className="table-title">{e.questionText}</div>
                        </div>
                      </td>
                      <td>{e.judgeName}</td>
                      <td>
                        <span className={verdictBadgeClass(e.verdict)}>
                          {e.verdict}
                        </span>
                      </td>
                      <td>
                        {e.reasoning ? (
                          <span>{e.reasoning}</span>
                        ) : (
                          <span className="empty-state">
                            (no reasoning provided)
                          </span>
                        )}
                      </td>
                      <td>
                        {new Date(e.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && hasEvaluations && !hasFiltered && (
            <p className="empty-state">
              No evaluations match the selected filters.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

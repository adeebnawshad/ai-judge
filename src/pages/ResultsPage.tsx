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

  // filter state
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedVerdicts, setSelectedVerdicts] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch evaluations, questions, judges in parallel
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

      // Index questions & judges for quick lookup
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

  function toggleInArray(
    current: string[],
    value: string,
    checked: boolean
  ): string[] {
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

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Results</h1>

      {loading && <p>Loading evaluations...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Summary bar */}
      {!loading && evaluations.length > 0 && (
        <div
          style={{
            margin: "1rem 0",
            padding: "0.75rem 1rem",
            border: "1px solid #444",
            borderRadius: "4px",
          }}
        >
          <strong>
            Pass rate:{" "}
            {total === 0 ? "N/A" : `${passRate.toFixed(1)}% pass of ${total} evaluations`}
          </strong>
          {total > 0 && (
            <span style={{ marginLeft: "0.75rem", fontSize: "0.9rem" }}>
              ({passCount} pass / {total - passCount} non-pass)
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      {!loading && evaluations.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginBottom: "1rem",
            border: "1px solid #333",
            padding: "0.75rem 1rem",
            borderRadius: "4px",
          }}
        >
          {/* Judges filter */}
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
              Filter by Judge
            </div>
            {judges.length === 0 ? (
              <p style={{ fontSize: "0.9rem" }}>No judges found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {judges.map((j) => (
                  <label key={j.id} style={{ fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedJudgeIds.includes(j.id)}
                      onChange={(e) =>
                        setSelectedJudgeIds((prev) =>
                          toggleInArray(prev, j.id, e.target.checked)
                        )
                      }
                    />{" "}
                    {j.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Questions filter */}
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
              Filter by Question
            </div>
            {questions.length === 0 ? (
              <p style={{ fontSize: "0.9rem" }}>No questions found.</p>
            ) : (
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {questions.map((q) => (
                  <label key={q.id} style={{ fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(q.id)}
                      onChange={(e) =>
                        setSelectedQuestionIds((prev) =>
                          toggleInArray(prev, q.id, e.target.checked)
                        )
                      }
                    />{" "}
                    {q.question_text}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Verdict filter */}
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
              Filter by Verdict
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {["pass", "fail", "inconclusive"].map((v) => (
                <label key={v} style={{ fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedVerdicts.includes(v)}
                    onChange={(e) =>
                      setSelectedVerdicts((prev) =>
                        toggleInArray(prev, v, e.target.checked)
                      )
                    }
                  />{" "}
                  {v}
                </label>
              ))}
            </div>
          </div>

          {/* Reset filters */}
          <div>
            <button
              onClick={() => {
                setSelectedJudgeIds([]);
                setSelectedQuestionIds([]);
                setSelectedVerdicts([]);
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && evaluations.length === 0 && (
        <p>No evaluations found yet. Try running AI judges on a queue.</p>
      )}

      {!loading && filteredEvaluations.length > 0 && (
        <table
          style={{
            borderCollapse: "collapse",
            minWidth: "100%",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Submission</th>
              <th style={thStyle}>Question</th>
              <th style={thStyle}>Judge</th>
              <th style={thStyle}>Verdict</th>
              <th style={thStyle}>Reasoning</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvaluations.map((e) => (
              <tr key={e.id}>
                <td style={tdStyle}>{e.submissionId}</td>
                <td style={tdStyle}>{e.questionText}</td>
                <td style={tdStyle}>{e.judgeName}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      border: "1px solid #555",
                      fontSize: "0.8rem",
                    }}
                  >
                    {e.verdict}
                  </span>
                </td>
                <td style={tdStyle}>{e.reasoning}</td>
                <td style={tdStyle}>
                  {new Date(e.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading &&
        evaluations.length > 0 &&
        filteredEvaluations.length === 0 && (
          <p>No evaluations match the selected filters.</p>
        )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #555",
  padding: "0.5rem",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #333",
  padding: "0.5rem",
  verticalAlign: "top",
};

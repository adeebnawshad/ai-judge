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

export default function QueuePage() {
  const { queueId } = useParams<{ queueId: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [questionJudges, setQuestionJudges] = useState<QuestionJudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!queueId) return;
    loadData(queueId);
  }, [queueId]);

  async function loadData(queueId: string) {
    setLoading(true);
    setError(null);

    try {
      const [questionsRes, judgesRes, mappingsRes] = await Promise.all([
        supabase
          .from("questions")
          .select("*")
          .eq("queue_id", queueId)
          .order("id", { ascending: true }),
        supabase
          .from("judges")
          .select("*")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("question_judges")
          .select("*")
          .eq("queue_id", queueId),
      ]);

      if (questionsRes.error) throw questionsRes.error;
      if (judgesRes.error) throw judgesRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      setQuestions(questionsRes.data as Question[]);
      setJudges(judgesRes.data as Judge[]);
      setQuestionJudges(mappingsRes.data as QuestionJudge[]);
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

  if (!queueId) {
    return <div style={{ padding: "1rem" }}>Missing queueId in URL.</div>;
  }

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Queue: {queueId}</h1>

      {loading && <p>Loading questions and judges...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && questions.length === 0 && (
        <p>No questions found for this queue. Did you import data?</p>
      )}

      {!loading && questions.length > 0 && (
        <table
          style={{
            borderCollapse: "collapse",
            marginTop: "1rem",
            minWidth: "700px",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  borderBottom: "1px solid #555",
                  padding: "0.5rem",
                  textAlign: "left",
                }}
              >
                Question
              </th>
              <th
                style={{
                  borderBottom: "1px solid #555",
                  padding: "0.5rem",
                  textAlign: "left",
                }}
              >
                Question Type
              </th>
              <th
                style={{
                  borderBottom: "1px solid #555",
                  padding: "0.5rem",
                  textAlign: "left",
                }}
              >
                Judges
              </th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  {q.question_text}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                    fontSize: "0.85rem",
                    color: "#ccc",
                  }}
                >
                  {q.question_type}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  {judges.length === 0 ? (
                    <span>No judges yet. Create some on the Judges page.</span>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      {judges.map((judge) => (
                        <label
                          key={judge.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            border: "1px solid #444",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                          }}
                        >
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
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Judge = {
  id: string;
  name: string;
  system_prompt: string;
  model_name: string;
  active: boolean;
};

const emptyForm = {
  name: "",
  system_prompt: "",
  model_name: "", // sensible default, still editable
  active: true,
};

const MODEL_PRESETS: { label: string; value: string }[] = [
  { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
];

export default function JudgesPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadJudges();
  }, []);

  async function loadJudges() {
    setLoading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const { data, error } = await supabase
        .from("judges")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setError("Failed to load judges.");
      } else {
        setJudges((data ?? []) as Judge[]);
      }
    } catch (err) {
      console.error(err);
      setError("Unexpected error while loading judges.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setSaveMessage(null);
  }

  function startEdit(judge: Judge) {
    setEditingId(judge.id);
    setForm({
      name: judge.name,
      system_prompt: judge.system_prompt,
      model_name: judge.model_name,
      active: judge.active,
    });
    setError(null);
    setSaveMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const trimmedName = form.name.trim();
    const trimmedPrompt = form.system_prompt.trim();
    const trimmedModel = form.model_name.trim();

    if (!trimmedName || !trimmedPrompt || !trimmedModel) {
      setError("Name, model, and system prompt are required.");
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        // Update existing judge
        const { data, error } = await supabase
          .from("judges")
          .update({
            name: trimmedName,
            system_prompt: trimmedPrompt,
            model_name: trimmedModel,
            active: form.active,
          })
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;

        setJudges((prev) =>
          prev.map((j) => (j.id === editingId ? (data as Judge) : j))
        );
        setSaveMessage("Judge updated.");
      } else {
        // Create new judge
        const { data, error } = await supabase
          .from("judges")
          .insert({
            name: trimmedName,
            system_prompt: trimmedPrompt,
            model_name: trimmedModel,
            active: form.active,
          })
          .select()
          .single();

        if (error) throw error;

        setJudges((prev) => [...prev, data as Judge]);
        setSaveMessage("Judge created.");
      }

      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError("Failed to save judge.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(judge: Judge, newActive: boolean) {
    setError(null);
    setSaveMessage(null);

    // Optimistic UI update
    setJudges((prev) =>
      prev.map((j) => (j.id === judge.id ? { ...j, active: newActive } : j))
    );

    const { error } = await supabase
      .from("judges")
      .update({ active: newActive })
      .eq("id", judge.id);

    if (error) {
      console.error(error);
      setError("Failed to update active state.");
      // revert UI
      setJudges((prev) =>
        prev.map((j) => (j.id === judge.id ? { ...j, active: judge.active } : j))
      );
    } else {
      setSaveMessage("Active state updated.");
    }
  }

  const isFormDisabled = saving || loading;

  return (
    <section className="page-section">
      <header className="page-header">
        <h1 className="page-title">AI Judges</h1>
        <p className="page-subtitle">
          Define reusable judges with a name, target model, and rubric. Judges can be
          toggled active/inactive and assigned per question in a queue.
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        {error && (
          <div className="status-banner status-error" role="status">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="status-banner status-success" role="status">
            {saveMessage}
          </div>
        )}

        <div className="card-body" style={{ gap: "1rem" }}>
          <div className="card-main">
            <div className="section-header">
              <h2 className="section-title">Existing judges</h2>
              {loading && (
                <span className="section-tag">Loading…</span>
              )}
            </div>

            {judges.length === 0 && !loading ? (
              <p className="empty-state">
                No judges yet. Create your first judge using the form below.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th style={{ width: "1%" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judges.map((judge) => (
                      <tr key={judge.id}>
                        <td>
                          <div className="table-primary">
                            <div className="table-title">{judge.name}</div>
                          </div>
                        </td>
                        <td>
                          <code className="code-pill">{judge.model_name}</code>
                        </td>
                        <td>
                          <span
                            className={
                              judge.active ? "badge badge-success" : "badge badge-muted"
                            }
                          >
                            {judge.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={judge.active}
                                onChange={(e) =>
                                  handleToggleActive(judge, e.target.checked)
                                }
                              />
                              <span className="slider" />
                            </label>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => startEdit(judge)}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ gap: "0.75rem" }}>
          <div className="section-header">
            <h2 className="section-title">
              {editingId ? "Edit judge" : "Create judge"}
            </h2>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={startCreate}
                disabled={isFormDisabled}
              >
                Cancel edit
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="form-grid"
          >
            <div className="form-field">
              <label className="field-label" htmlFor="judge-name">
                Name
              </label>
              <input
                id="judge-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="text-input"
                placeholder="e.g. Sky color checker"
                required
                disabled={isFormDisabled}
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="judge-model">
                Target model
              </label>

              <div className="model-row">
                <input
                  id="judge-model"
                  name="model_name"
                  value={form.model_name}
                  onChange={handleChange}
                  className="text-input"
                  placeholder="e.g. gemini-2.5-flash"
                  required
                  disabled={isFormDisabled}
                />

                <select
                  name="modelPreset"
                  className="select-input"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    setForm((prev) => ({ ...prev, model_name: value }));
                  }}
                  disabled={isFormDisabled}
                  defaultValue=""
                >
                  <option value="">Presets…</option>
                  {MODEL_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="field-help">
                You can type any valid provider model name, or pick a preset. The backend
                will validate it when running evaluations.
              </p>
            </div>

            <div className="form-field form-field-full">
              <label className="field-label" htmlFor="judge-prompt">
                System prompt / rubric
              </label>
              <textarea
                id="judge-prompt"
                name="system_prompt"
                value={form.system_prompt}
                onChange={handleChange}
                rows={5}
                className="textarea-input"
                placeholder="Explain how to decide pass / fail / inconclusive for this question type…"
                required
                disabled={isFormDisabled}
              />
              <p className="field-help">
                This text is sent as the system prompt when the judge evaluates answers.
              </p>
            </div>

            <div className="form-footer">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
                <span>Active</span>
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isFormDisabled}
              >
                {saving
                  ? "Saving…"
                  : editingId
                  ? "Save changes"
                  : "Create judge"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

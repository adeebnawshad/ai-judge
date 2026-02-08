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
  model_name: "gpt-4.1-mini",
  active: true,
};

export default function JudgesPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load judges on first render
  useEffect(() => {
    loadJudges();
  }, []);

  async function loadJudges() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("judges")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load judges.");
    } else {
      setJudges(data as Judge[]);
    }
    setLoading(false);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
  }

  function startEdit(judge: Judge) {
    setEditingId(judge.id);
    setForm({
      name: judge.name,
      system_prompt: judge.system_prompt,
      model_name: judge.model_name,
      active: judge.active,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        // Update existing judge
        const { data, error } = await supabase
          .from("judges")
          .update({
            name: form.name,
            system_prompt: form.system_prompt,
            model_name: form.model_name,
            active: form.active,
          })
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;

        setJudges((prev) =>
          prev.map((j) => (j.id === editingId ? (data as Judge) : j))
        );
      } else {
        // Create new judge
        const { data, error } = await supabase
          .from("judges")
          .insert({
            name: form.name,
            system_prompt: form.system_prompt,
            model_name: form.model_name,
            active: form.active,
          })
          .select()
          .single();

        if (error) throw error;

        setJudges((prev) => [...prev, data as Judge]);
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
    // Optimistic UI update
    setJudges((prev) =>
      prev.map((j) =>
        j.id === judge.id ? { ...j, active: newActive } : j
      )
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
        prev.map((j) =>
          j.id === judge.id ? { ...j, active: judge.active } : j
        )
      );
    }
  }

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Judges</h1>

      {loading && <p>Loading judges...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Judges table */}
      {judges.length === 0 && !loading ? (
        <p>No judges yet. Create one below.</p>
      ) : (
        <table
          style={{
            borderCollapse: "collapse",
            marginBottom: "1.5rem",
            minWidth: "600px",
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #555", padding: "0.5rem" }}>
                Name
              </th>
              <th style={{ borderBottom: "1px solid #555", padding: "0.5rem" }}>
                Model
              </th>
              <th style={{ borderBottom: "1px solid #555", padding: "0.5rem" }}>
                Active
              </th>
              <th style={{ borderBottom: "1px solid #555", padding: "0.5rem" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {judges.map((judge) => (
              <tr key={judge.id}>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  {judge.name}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  {judge.model_name}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={judge.active}
                    onChange={(e) =>
                      handleToggleActive(judge, e.target.checked)
                    }
                  />
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #333",
                    padding: "0.5rem",
                  }}
                >
                  <button onClick={() => startEdit(judge)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Form */}
      <h2>{editingId ? "Edit Judge" : "Create Judge"}</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", maxWidth: "600px" }}
      >
        <label style={{ marginBottom: "0.5rem" }}>
          Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            style={{ width: "100%", padding: "0.25rem" }}
            required
          />
        </label>

        <label style={{ marginBottom: "0.5rem" }}>
          Model name
          <input
            name="model_name"
            value={form.model_name}
            onChange={handleChange}
            style={{ width: "100%", padding: "0.25rem" }}
            required
          />
        </label>

        <label style={{ marginBottom: "0.5rem" }}>
          System prompt / rubric
          <textarea
            name="system_prompt"
            value={form.system_prompt}
            onChange={handleChange}
            rows={4}
            style={{ width: "100%", padding: "0.25rem" }}
            required
          />
        </label>

        <label style={{ marginBottom: "0.5rem" }}>
          <input
            type="checkbox"
            name="active"
            checked={form.active}
            onChange={handleChange}
          />{" "}
          Active
        </label>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
              ? "Save changes"
              : "Create judge"}
          </button>
          {editingId && (
            <button type="button" onClick={startCreate}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

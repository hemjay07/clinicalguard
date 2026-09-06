import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";
import { NoteLink } from "../components/FeedbackNote";
import { DraftList, useDrafts } from "../components/DraftList";
import { encodeConditions } from "../selection";
import type { SelectedCondition } from "../types";

// No subtype selector here (PRD v1.3.1 §2): the NSTG "subtype" field is
// overloaded with document-structure headings ("Signs", "General"), and in
// practice the clinical variant is expressed in the query and ground truth,
// not at selection time. Headings remain as grouping inside the source panel.
export function ConditionPicker() {
  const { data, error, loading } = useFetch(() => api.listConditions(), []);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<SelectedCondition[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const { drafts, remove } = useDrafts();

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return (needle ? data.filter((c) => c.name.toLowerCase().includes(needle)) : data).slice(0, 200);
  }, [data, q]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.condition_id)), [selected]);

  function addCondition(id: number, name: string) {
    if (selectedIds.has(id)) return;
    setSelected((prev) => [...prev, { condition_id: id, name, subtype: null }]);
  }
  function removeCondition(id: number) {
    setSelected((prev) => prev.filter((s) => s.condition_id !== id));
  }

  function proceed() {
    if (selected.length === 0) return;
    const refs = selected.map((s) => ({ condition_id: s.condition_id, subtype: null }));
    navigate(`/author/compose?conditions=${encodeConditions(refs)}`);
  }

  return (
    <PageContainer>
      <h1 className="font-serif text-2xl font-semibold text-neutral-900">Author a case</h1>
      {/* Testers read "select one or more conditions" as "author one case per
          condition", and produced thin single-condition cases for what was
          clinically one presentation. The copy now says the quiet part. */}
      <p className="mt-1 max-w-2xl text-neutral-600">
        Which condition is your case about? If it involves more than one (say, TB with HIV
        co-infection), add each of them, so the guideline for every one sits beside you as you
        write. You're writing one case, not one per condition. Pick something you manage often.
      </p>

      {/* An author arriving here to start a case is often the same author who
          already began one and lost it. Show the unfinished ones before the
          condition list, so picking a condition isn't the only way forward. */}
      {drafts.length > 0 && selected.length === 0 && (
        <div className="mt-5">
          <DraftList drafts={drafts} remove={remove} />
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-neutral-400">Or start a new case</p>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-xs font-medium tracking-wide text-neutral-500">
            Your case covers:
          </div>
          <div className="space-y-2">
            {selected.map((s) => (
              <div key={s.condition_id} className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 px-3 py-2">
                <span className="font-medium text-neutral-800">{s.name}</span>
                <button
                  onClick={() => removeCondition(s.condition_id)}
                  className="ml-auto rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200"
                  aria-label={`Remove ${s.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {/* Each on its own row: both are inline-level, so without `block`
              the link and the primary button share a line and collide. */}
          <button
            onClick={() => { setQ(""); searchRef.current?.focus(); }}
            className="mt-2 block text-xs font-medium text-brand-700 hover:underline"
          >
            + add another condition it involves
          </button>
          <button
            onClick={proceed}
            className="cg-btn-primary mt-4"
          >
            Start this case →
          </button>
        </div>
      )}

      <input
        ref={searchRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search conditions… (e.g. Malaria)"
        className="cg-input mt-4 max-w-md"
      />

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white">
          {filtered.map((c) => {
            const added = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => (added ? removeCondition(c.id) : addCondition(c.id, c.name))}
                className={`flex w-full items-center justify-between border-b border-neutral-100 px-4 py-2 text-left text-sm hover:bg-neutral-50 ${
                  added ? "bg-brand-50" : ""
                }`}
              >
                <span className="font-medium text-neutral-700">{c.name}</span>
                <span className={`text-xs ${added ? "text-brand-700" : "text-neutral-400"}`}>
                  {added ? "✓ selected — remove" : "+ add"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-5">
        <NoteLink flow="authoring" context="condition picker" />
      </div>
    </PageContainer>
  );
}

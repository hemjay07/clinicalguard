import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

export function ConditionPicker() {
  const { data, error, loading } = useFetch(() => api.listConditions(), []);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subtype, setSubtype] = useState<string>("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return (needle ? data.filter((c) => c.name.toLowerCase().includes(needle)) : data).slice(0, 200);
  }, [data, q]);

  const subtypes = useFetch(
    () => (selectedId ? api.subtypes(selectedId) : Promise.resolve([])),
    [selectedId]
  );

  function proceed() {
    if (!selectedId) return;
    const qs = subtype ? `?subtype=${encodeURIComponent(subtype)}` : "";
    navigate(`/author/${selectedId}${qs}`);
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-slate-800">Author a case</h1>
      <p className="mt-1 text-slate-600">Search for a condition, optionally pick a subtype, then start authoring.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search conditions… (e.g. Malaria)"
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
      />

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setSubtype(""); }}
                className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                  selectedId === c.id ? "bg-brand-50" : ""
                }`}
              >
                <span className="font-medium text-slate-700">{c.name}</span>
                <span className="text-xs text-slate-400">{c.counts.treatments} treatments</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {selectedId ? (
              <>
                <div className="text-sm font-semibold text-slate-700">
                  {data.find((c) => c.id === selectedId)?.name}
                </div>
                <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Subtype (optional)
                </label>
                {subtypes.loading ? (
                  <div className="mt-2"><Spinner label="Loading subtypes…" /></div>
                ) : (
                  <select
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">— whole condition —</option>
                    {(subtypes.data ?? []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={proceed}
                  className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Author case →
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select a condition to choose a subtype and begin.</p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

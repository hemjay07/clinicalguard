import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

export function SafetyRules() {
  const { data, error, loading } = useFetch(() => api.safetyRules(), []);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState("ALL");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      if (verified === "VERIFIED" && !r.is_verified) return false;
      if (verified === "UNVERIFIED" && r.is_verified) return false;
      const needle = q.trim().toLowerCase();
      if (needle && !r.description.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, q, verified]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold text-neutral-900">Safety Rules</h1>
      <p className="mt-1 text-slate-600">
        The deterministic safety engine fires verified rules against AI responses. This is a
        read-only view of all active rules in the database.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search descriptions…"
          className="cg-input max-w-xs"
        />
        <select value={verified} onChange={(e) => setVerified(e.target.value)} className="cg-input w-auto">
          <option value="ALL">All</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <ul className="mt-5 space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="cg-card px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {r.condition_id ? (
                  <Link to={`/conditions/${r.condition_id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {r.condition_name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-neutral-500">{r.condition_name}</span>
                )}
                {r.is_verified && (
                  <span className="cg-badge border border-brand-200 bg-brand-50 text-brand-700">Verified</span>
                )}
                {!r.is_active && (
                  <span className="cg-badge border border-neutral-200 bg-neutral-100 text-neutral-500">Inactive</span>
                )}
              </div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{r.description}</p>
              <p className="mt-2 text-xs text-neutral-400">{r.source}</p>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="cg-card px-4 py-10 text-center text-sm text-neutral-500">No rules match the filters.</li>
          )}
        </ul>
      )}
    </PageContainer>
  );
}

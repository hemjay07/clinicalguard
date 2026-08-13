// Owner-only: every friction note with its context, newest first, so
// repeated confusions stand out. Read-only by design (capture-only system —
// there is no reply/resolve action to build).

import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { useAuth } from "../AuthContext";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";
import type { FeedbackItem } from "../types";

export function Feedback() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch<FeedbackItem[]>(() => api.listFeedback(), []);

  if (user && !user.is_owner) {
    return <PageContainer><ErrorBox message="Owner access required." /></PageContainer>;
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-neutral-900">Feedback notes</h1>
        <button onClick={() => api.downloadFeedbackCsv()} className="cg-btn-secondary">
          Download CSV
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        In-flow notes and exit prompts from both flows, newest first.
      </p>

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}
      {data && data.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">No notes yet.</p>
      )}
      {data && data.length > 0 && (
        <ul className="mt-6 space-y-2">
          {data.map((fb) => (
            <li key={fb.id} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-neutral-400">
                <span className="font-medium text-neutral-600">{fb.user}</span>
                <span>· {fb.flow}</span>
                {fb.context && <span>· {fb.context}</span>}
                <span className="ml-auto">{new Date(fb.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-800">{fb.note}</p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

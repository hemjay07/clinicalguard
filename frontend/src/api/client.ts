// Typed fetch wrapper around the ClinicalGuard API.

import { supabase } from "../supabase";
import type {
  ConditionListItem,
  ConditionDetails,
  SafetyRule,
  SourceMaterial,
  EvalCaseListItem,
  EvalCaseDetail,
  EvalCasePayload,
  CreatedCase,
  AuthUser,
  DecompositionItemsPayload,
  DecompositionResponse,
  DecompositionDecision,
  FeedbackFlow,
  FeedbackItem,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8011";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  // supabase-js holds the session locally and refreshes it as needed; the
  // verified access token is the only identity the backend accepts (ADR-031).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* non-JSON error body */
    }
    const message =
      typeof detail === "string" ? detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Cache for endpoints whose data is static per backend deployment (guideline
// data: conditions, subtypes, source material, safety rules). localStorage +
// stale-while-revalidate: anything cached in the last week renders instantly
// — including across a Render cold start — while a background refresh keeps
// the copy current for the next visit.
const CACHE_PREFIX = "cg_api_v2:";
const FRESH_TTL_MS = 30 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheStore(path: string, data: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota exceeded — serve uncached */
  }
}

async function cachedRequest<T>(path: string): Promise<T> {
  let entry: { at: number; data: T } | null = null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    if (raw) entry = JSON.parse(raw);
  } catch {
    /* corrupt cache entry — fall through to network */
  }
  const age = entry ? Date.now() - entry.at : Infinity;
  if (entry && age < FRESH_TTL_MS) return entry.data;
  if (entry && age < STALE_TTL_MS) {
    // Serve stale instantly; refresh behind for next time. The refresh also
    // wakes the free-tier backend, so nothing downstream pays the cold start.
    request<T>(path).then((data) => cacheStore(path, data)).catch(() => {});
    return entry.data;
  }
  const data = await request<T>(path);
  cacheStore(path, data);
  return data;
}

// Fire-and-forget wake-up call. The Render free tier spins the backend down
// when idle; pinging from the app shell on first load means it starts booting
// while the user is still reading the landing page. Once it's up, prefetch
// the conditions list (open endpoint) so the authoring entry point renders
// instantly even for a first-time visitor.
export function warmUpApi(): void {
  fetch(`${BASE}/health`)
    .then(() => api.listConditions())
    .catch(() => {
      /* backend waking up or offline — data fetches surface real errors */
    });
}

export const api = {
  baseUrl: BASE,
  health: () => request<{ status: string }>("/health"),
  listConditions: () => cachedRequest<ConditionListItem[]>("/api/v1/conditions"),
  subtypes: (id: number) =>
    cachedRequest<string[]>(`/api/v1/conditions/${id}/subtypes`),
  conditionDetails: (id: number) =>
    cachedRequest<ConditionDetails>(`/api/v1/conditions/${id}/details`),
  sourceMaterial: (id: number, subtype: string | null) => {
    const qs = subtype ? `?subtype=${encodeURIComponent(subtype)}` : "";
    return cachedRequest<SourceMaterial>(`/api/v1/conditions/${id}/source-material${qs}`);
  },
  safetyRules: () => cachedRequest<SafetyRule[]>("/api/v1/safety-rules"),
  listEvalCases: () => request<EvalCaseListItem[]>("/api/v1/eval-cases"),
  evalCaseCount: () => request<{ count: number }>("/api/v1/eval-cases/count"),
  evalCase: (id: number) =>
    request<EvalCaseDetail>(`/api/v1/eval-cases/${id}`),
  createEvalCase: (payload: EvalCasePayload) =>
    request<CreatedCase>("/api/v1/eval-cases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateEvalCase: (id: number, payload: EvalCasePayload) =>
    request<CreatedCase>(`/api/v1/eval-cases/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  me: () => request<AuthUser>("/api/v1/auth/me"),
  setCadre: (cadre: string, cadreOther: string | null) =>
    request<AuthUser>("/api/v1/auth/me/cadre", {
      method: "PUT",
      body: JSON.stringify({ cadre, cadre_other: cadreOther }),
    }),
  contributeInterest: () =>
    request<AuthUser>("/api/v1/auth/me/contribute-interest", { method: "POST" }),
  downloadAuthorsCsv: async () => {
    const res = await fetch(`${BASE}/api/v1/auth/authors/export`, {
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(res.status, null, `Export failed (${res.status})`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "authors.csv";
    a.click();
    URL.revokeObjectURL(blobUrl);
  },
  decompositionItems: () =>
    request<DecompositionItemsPayload>("/api/v1/decomposition/items"),
  myDecompositionResponses: () =>
    request<DecompositionResponse[]>("/api/v1/decomposition/responses"),
  saveDecompositionResponse: (
    itemId: number,
    payload: {
      decision: DecompositionDecision;
      split_count: number | null;
      split_labels: string[] | null;
      reason: string;
    },
  ) =>
    request<DecompositionResponse>(`/api/v1/decomposition/responses/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  // Friction capture (owner-readable only; submitting is open to any
  // signed-in user). The 204 response is deliberate — nothing to react to.
  submitFeedback: (flow: FeedbackFlow, context: string | null, note: string) =>
    request<void>("/api/v1/feedback", {
      method: "POST",
      body: JSON.stringify({ flow, context, note }),
    }),
  listFeedback: () => request<FeedbackItem[]>("/api/v1/feedback"),
  downloadFeedbackCsv: async () => {
    const res = await fetch(`${BASE}/api/v1/feedback/export`, {
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(res.status, null, `Export failed (${res.status})`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "feedback.csv";
    a.click();
    URL.revokeObjectURL(blobUrl);
  },
  // Owner-only CSV export; fetched with the auth header and saved as a blob
  // (a plain <a href> couldn't carry the Authorization header).
  downloadDecompositionCsv: async () => {
    const res = await fetch(`${BASE}/api/v1/decomposition/export?format=csv`, {
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(res.status, null, `Export failed (${res.status})`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "decomposition_responses.csv";
    a.click();
    URL.revokeObjectURL(blobUrl);
  },
};

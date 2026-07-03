// Typed fetch wrapper around the ClinicalGuard API.

import type {
  ConditionListItem,
  ConditionDetails,
  SafetyRule,
  SourceMaterial,
  EvalCaseListItem,
  EvalCaseDetail,
  EvalCasePayload,
  CreatedCase,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
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

// Session cache for endpoints whose data is static per backend deployment
// (guideline data: conditions, subtypes, source material, safety rules).
// Repeat navigation renders instantly instead of re-crossing the network.
const CACHE_PREFIX = "cg_api:";
const CACHE_TTL_MS = 30 * 60 * 1000;

async function cachedRequest<T>(path: string): Promise<T> {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + path);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at < CACHE_TTL_MS) return data as T;
    }
  } catch {
    /* corrupt cache entry — fall through to network */
  }
  const data = await request<T>(path);
  try {
    sessionStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota exceeded — serve uncached */
  }
  return data;
}

// Fire-and-forget wake-up call. The Render free tier spins the backend down
// when idle; pinging from the app shell on first load means it starts booting
// while the user is still reading the landing page.
export function warmUpApi(): void {
  fetch(`${BASE}/health`).catch(() => {
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
  evalCase: (id: number) =>
    request<EvalCaseDetail>(`/api/v1/eval-cases/${id}`),
  createEvalCase: (payload: EvalCasePayload) =>
    request<CreatedCase>("/api/v1/eval-cases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

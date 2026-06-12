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

export const api = {
  baseUrl: BASE,
  health: () => request<{ status: string }>("/health"),
  listConditions: () => request<ConditionListItem[]>("/api/v1/conditions"),
  subtypes: (id: number) =>
    request<string[]>(`/api/v1/conditions/${id}/subtypes`),
  conditionDetails: (id: number) =>
    request<ConditionDetails>(`/api/v1/conditions/${id}/details`),
  sourceMaterial: (id: number, subtype: string | null) => {
    const qs = subtype ? `?subtype=${encodeURIComponent(subtype)}` : "";
    return request<SourceMaterial>(`/api/v1/conditions/${id}/source-material${qs}`);
  },
  safetyRules: () => request<SafetyRule[]>("/api/v1/safety-rules"),
  listEvalCases: () => request<EvalCaseListItem[]>("/api/v1/eval-cases"),
  evalCase: (id: number) =>
    request<EvalCaseDetail>(`/api/v1/eval-cases/${id}`),
  createEvalCase: (payload: EvalCasePayload) =>
    request<CreatedCase>("/api/v1/eval-cases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

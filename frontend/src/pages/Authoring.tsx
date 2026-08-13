// Authoring shell: owns the shared FormState (drafts, autosave, submit) and
// hosts the two views onto it — the guided flow (default) and the full form.
// Both read/write the same state, so edits in either stay in sync. The right
// sidebar toggles between NSTG source material and a live case preview.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, ErrorBox, Spinner } from "../components/ui";
import { SourcePanel } from "../components/SourcePanel";
import { FullForm } from "../components/FullForm";
import { GuidedFlow } from "../components/GuidedFlow";
import { CasePreview } from "../components/CasePreview";
import { NoteButton } from "../components/FeedbackNote";
import { saveDraft, loadDraft, clearDraft } from "../storage";
import { useAuth } from "../AuthContext";
import { decodeConditions, draftSlug } from "../selection";
import { EMPTY, toPayload, fromExpectedResponse, safetyAnswered, SAFETY_PROMPT } from "../caseForm";
import type { FormState, ValidationIssue } from "../caseForm";
import { SCREENS } from "../flow";
import type { SourceMaterial, ConditionRef, EvalCaseDetail } from "../types";

interface SourceEntry { ref: ConditionRef; data: SourceMaterial }

type ViewMode = "guided" | "form";
const VIEW_KEY = "cg_author_view";
const INTRO_KEY = "cg_guided_intro_seen";
const REVIEW_SCREEN = "3.2";

// One-time introduction shown before the MD's very first guided session.
function IntroOverlay({ onStart, onUseForm }: { onStart: () => void; onUseForm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-7 shadow-xl">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">Authoring, one question at a time</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-neutral-600">
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>The tool walks you through authoring one clinical question at a time, across three phases: frame the case, author the expected response, safety layer.</li>
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>You can jump between questions and phases freely using the phase bar, the numbered dots, or the arrows.</li>
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>You can switch to a full form view at any time — both views edit the same case.</li>
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>Progress is auto-saved. Close the tab and pick up where you left off.</li>
        </ul>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onUseForm} className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600">Prefer the full form?</button>
          <button onClick={onStart} className="cg-btn-primary px-6">Start authoring</button>
        </div>
      </div>
    </div>
  );
}

export function Authoring() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Two entry points share this page: /author/compose (new case, conditions
  // via ?conditions=) and /cases/:caseId/edit (editing an existing case —
  // the whole point of building the safety redesign first, so it doesn't
  // get built twice). caseId presence is what distinguishes them.
  const { caseId: caseIdParam } = useParams();
  const isEdit = !!caseIdParam;
  const editCaseId = isEdit ? Number(caseIdParam) : null;

  const editCase = useFetch<EvalCaseDetail | null>(
    () => (editCaseId ? api.evalCase(editCaseId) : Promise.resolve(null)),
    [editCaseId]
  );

  const refs: ConditionRef[] = useMemo(() => {
    if (isEdit) {
      const conds = editCase.data?.expected_response?.conditions ?? [];
      return conds.map((c: { condition_id: number; subtype: string | null }) => ({
        condition_id: c.condition_id,
        subtype: c.subtype ?? null,
      }));
    }
    return decodeConditions(searchParams.get("conditions"));
  }, [isEdit, editCase.data, searchParams]);
  const slug = useMemo(() => draftSlug(refs), [refs]);

  const sources = useFetch<SourceEntry[]>(
    () => Promise.all(refs.map((r) => api.sourceMaterial(r.condition_id, r.subtype).then((data) => ({ ref: r, data })))),
    [slug]
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveKind, setSaveKind] = useState<"none" | "auto" | "submitted">("none");
  const [loadedDraftAt, setLoadedDraftAt] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPanel, setShowPanel] = useState(() => sessionStorage.getItem("cg_show_source") !== "0");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"source" | "preview">(() =>
    sessionStorage.getItem("cg_sidebar_tab") === "preview" ? "preview" : "source");
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) === "form" ? "form" : "guided"));
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));

  // Guided-flow position lives in the URL (?screen=2.3) so a specific question
  // can be shared for review. Invalid/absent falls back to the first screen.
  const screenParam = searchParams.get("screen");
  const screenId = SCREENS.some((s) => s.id === screenParam) ? (screenParam as string) : SCREENS[0].id;
  const goTo = (id: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("screen", id);
      return p;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setViewMode = (v: ViewMode) => { setView(v); localStorage.setItem(VIEW_KEY, v); };
  const dismissIntro = (v: ViewMode) => { localStorage.setItem(INTRO_KEY, "1"); setShowIntro(false); if (v !== view) setViewMode(v); };

  useEffect(() => { sessionStorage.setItem("cg_show_source", showPanel ? "1" : "0"); }, [showPanel]);
  useEffect(() => { sessionStorage.setItem("cg_sidebar_tab", sidebarTab); }, [sidebarTab]);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Edit mode: seed the form from the fetched case once it arrives. No draft
  // persistence — the server copy is the source of truth, not localStorage.
  useEffect(() => {
    if (!isEdit) return;
    if (!editCase.data) return;
    setForm(fromExpectedResponse(editCase.data));
    setActiveTab(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editCase.data]);

  // Create mode: resume an autosaved draft, if any.
  useEffect(() => {
    if (isEdit) return;
    const d = loadDraft<FormState>(slug);
    const base = d ? { ...EMPTY, ...d.state } : { ...EMPTY };
    // Drafts saved before v1.3.1 carried tiered escalation — merge into the flat field.
    const legacy = d?.state as (FormState & { esc_required?: string; esc_expected?: string }) | undefined;
    if (legacy && !base.escalation && (legacy.esc_required || legacy.esc_expected)) {
      base.escalation = [legacy.esc_required, legacy.esc_expected].filter(Boolean).join("\n");
    }
    setForm(base);
    setSavedAt(d ? d.savedAt : null);
    setSaveKind(d ? "auto" : "none");
    setLoadedDraftAt(d ? d.savedAt : null);
    setLoadedDraft(true);
    setActiveTab(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, slug]);

  useEffect(() => {
    if (isEdit || !loadedDraft) return;
    setSavedAt(saveDraft(slug, form));
    setSaveKind("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const toggleArchetype = (value: string) =>
    setForm((prev) => ({ ...prev, archetypes: prev.archetypes.includes(value) ? prev.archetypes.filter((x) => x !== value) : [...prev.archetypes, value] }));

  function discardDraft() {
    // The one destructive control on this page — always confirm.
    if (!window.confirm("Discard this draft and start fresh? Everything entered for this case will be cleared.")) return;
    clearDraft(slug); setForm(EMPTY); setSavedAt(null); setSaveKind("none"); setLoadedDraftAt(null);
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const saveIndicator =
    saveKind === "auto" && savedAt ? `Auto-saved at ${fmtTime(savedAt)}`
    : saveKind === "submitted" && savedAt ? `${isEdit ? "Saved" : "Submitted"} at ${fmtTime(savedAt)}`
    : isEdit ? "No unsaved changes" : "Not yet saved";

  const names = useMemo(() => (sources.data ?? []).map((s) => s.data.condition.name), [sources.data]);

  const payload = useMemo(() => toPayload(form, refs), [form, refs]);

  // Where a friction note would land: flow position (guided screen or full
  // form) plus which case, so repeated confusions map back to a screen/field.
  const currentScreen = SCREENS.find((s) => s.id === screenId);
  const noteContext =
    (isEdit ? `edit case ${editCaseId} · ` : "") +
    (view === "guided" ? `screen ${screenId} (${currentScreen?.crumb ?? "?"})` : "full form");

  async function submit() {
    // No client-side gating (v1.3.1 §4) except safety (ADR-029) — the one
    // deliberate exception. Checked before the request so an unresolved
    // safety question never round-trips to the server.
    if (!safetyAnswered(form)) {
      setIssues([{ message: SAFETY_PROMPT, screenId: "3.1" }]);
      if (view === "guided") goTo("3.1");
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setIssues([]);
    setSubmitting(true);
    try {
      if (isEdit && editCaseId) {
        const updated = await api.updateEvalCase(editCaseId, payload);
        setSaveKind("submitted"); setSavedAt(new Date().toISOString());
        navigate(`/cases/${editCaseId}`, { state: { updated: true, warnings: updated.warnings } });
      } else {
        const created = await api.createEvalCase(payload);
        setSaveKind("submitted"); setSavedAt(new Date().toISOString());
        clearDraft(slug);
        // Land the author on their own case, with a success banner (and any
        // server warnings) — not on an anonymous list.
        navigate(`/cases/${created.id}`, { state: { submitted: true, warnings: created.warnings } });
      }
    } catch (e) {
      if (e instanceof ApiError && e.detail && typeof e.detail === "object" && "errors" in (e.detail as any))
        setIssues(((e.detail as any).errors as string[]).map((m) => ({ message: m, screenId: null })));
      else setIssues([{ message: e instanceof Error ? e.message : "Submission failed.", screenId: null }]);
      if (view === "guided") goTo(REVIEW_SCREEN);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (isEdit && editCase.loading) {
    return <PageContainer><Spinner label="Loading case…" /></PageContainer>;
  }
  if (isEdit && editCase.error) {
    return <PageContainer><ErrorBox message={editCase.error} /></PageContainer>;
  }
  if (isEdit && editCase.data && editCase.data.author_user_id !== user?.id) {
    return (
      <PageContainer>
        <ErrorBox message="You can only edit your own cases." />
        <Link to={`/cases/${editCaseId}`} className="cg-link mt-3 inline-block">← Back to case</Link>
      </PageContainer>
    );
  }
  if (refs.length === 0) {
    return (
      <PageContainer>
        <ErrorBox message="No conditions selected." />
        <Link to="/author" className="cg-link mt-3 inline-block">← Choose conditions</Link>
      </PageContainer>
    );
  }

  const sourceArea = (
    <div className="flex h-full flex-col">
      {/* Sidebar mode switch: NSTG source material vs live case preview. */}
      <div className="flex gap-1 border-b border-neutral-200 bg-neutral-50 p-1.5">
        {([["source", "Source material"], ["preview", "Case preview"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSidebarTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sidebarTab === key ? "bg-white text-brand-700 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:bg-neutral-100"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {sidebarTab === "preview" ? (
        <div className="min-h-0 flex-1">
          <CasePreview
            form={form}
            screenId={view === "guided" ? screenId : null}
            onJump={(id) => { if (view !== "guided") setViewMode("guided"); goTo(id); setMobileOpen(false); }}
          />
        </div>
      ) : (
        <>
          {(sources.data?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 px-2 pt-2">
              {(sources.data ?? []).map((s, i) => (
                <button key={s.ref.condition_id} onClick={() => setActiveTab(i)}
                  className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${i === activeTab ? "bg-white text-brand-700 ring-1 ring-neutral-200" : "text-neutral-500 hover:bg-neutral-100"}`}>
                  {s.data.condition.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <SourcePanel data={sources.data?.[activeTab]?.data ?? null} loading={sources.loading} error={sources.error} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-7xl gap-5 px-6 py-6">
      <div className={showPanel ? "w-full lg:w-[60%]" : "mx-auto w-full max-w-3xl"}>
        {/* Sticky header bar */}
        <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50/90 px-4 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-base font-semibold text-neutral-900">{names.length ? names.join(", ") : "Loading…"}</h1>
            <p className="truncate text-xs text-neutral-400">{isEdit ? "Editing as" : "Authoring as"} {user?.display_name ?? "…"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* View switch: guided (default) vs full form */}
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
              {([["guided", "Guided"], ["form", "Full form"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setViewMode(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === key ? "bg-brand-700 text-white" : "text-neutral-500 hover:bg-neutral-100"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{saveIndicator}</span>
            <button onClick={() => setShowPanel((s) => !s)} className="cg-btn-ghost hidden px-2 py-1 text-xs lg:inline-flex">{showPanel ? "Hide source" : "Show source"}</button>
          </div>
        </div>

        {loadedDraftAt && !draftDismissed && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 px-3.5 py-1.5 text-xs text-amber-800">
            <span>Resumed draft from {fmtTime(loadedDraftAt)} on {new Date(loadedDraftAt).toLocaleDateString()}.</span>
            <span className="flex items-center gap-3">
              <button onClick={discardDraft} className="font-medium underline hover:no-underline">Discard and start fresh</button>
              <button onClick={() => setDraftDismissed(true)} aria-label="Dismiss" className="font-medium hover:text-amber-950">✕</button>
            </span>
          </div>
        )}

        {view === "form" && issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-medium">Please fix:</p>
            <ul className="list-disc space-y-0.5 pl-5">{issues.map((iss, i) => <li key={i}>{iss.message}</li>)}</ul>
          </div>
        )}

        {view === "guided" ? (
          <GuidedFlow
            form={form} set={set} payload={payload}
            screenId={screenId} goTo={goTo}
            toggleArchetype={toggleArchetype}
            onSubmit={submit} submitting={submitting} issues={issues}
          />
        ) : (
          <FullForm
            form={form} set={set}
            toggleArchetype={toggleArchetype}
            onSubmit={submit} submitting={submitting}
          />
        )}
      </div>

      {showPanel && (
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[40%] overflow-hidden rounded-lg border border-neutral-200 bg-white lg:block">
          {sourceArea}
        </aside>
      )}

      {showIntro && view === "guided" && (
        <IntroOverlay onStart={() => dismissIntro("guided")} onUseForm={() => dismissIntro("form")} />
      )}

      {showTop && view === "form" && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="cg-btn-secondary fixed bottom-20 right-5 z-30 shadow-sm lg:bottom-5">↑ Top</button>
      )}
      <NoteButton flow="authoring" context={noteContext} />
      <button onClick={() => setMobileOpen(true)} className="cg-btn-primary fixed bottom-5 right-5 z-30 shadow-lg lg:hidden">Source</button>
      <div className={`fixed inset-0 z-40 transform bg-white transition-transform duration-200 ease-out lg:hidden ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <button onClick={() => setMobileOpen(false)} className="cg-btn-ghost m-2 self-end">✕ Close</button>
          <div className="min-h-0 flex-1">{sourceArea}</div>
        </div>
      </div>
    </div>
  );
}

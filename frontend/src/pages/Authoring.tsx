// Authoring shell: owns the shared FormState (drafts, autosave, submit) and
// hosts the two views onto it — the guided flow (default) and the full form.
// Both read/write the same state, so edits in either stay in sync. The right
// sidebar toggles between NSTG source material and a live case preview.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, ErrorBox, Spinner } from "../components/ui";
import { SourcePanel, sourceSectionsFor } from "../components/SourcePanel";
import { FullForm } from "../components/FullForm";
import { GuidedFlow } from "../components/GuidedFlow";
import { CasePreview } from "../components/CasePreview";
import { NoteLink } from "../components/FeedbackNote";
import { saveDraft, loadDraft, clearDraft } from "../storage";
import { useAuth } from "../AuthContext";
import { decodeConditions, draftSlug } from "../selection";
import {
  EMPTY, toPayload, fromExpectedResponse, safetyAnswered, provenanceAnswered, isBlank,
  SAFETY_PROMPT, PROVENANCE_PROMPT, PROVENANCE_NOTES_PROMPT,
} from "../caseForm";
import type { FormState, ValidationIssue } from "../caseForm";
import { screenById, FLOW_STEPS, isValidFlowParam, stepIndexForScreen, groupScreens } from "../flow";
import type { SourceMaterial, ConditionRef, EvalCaseDetail } from "../types";
import { CADRES } from "../types";
import { getAuthorView, setAuthorView, subscribeAuthorView } from "../authorView";
import type { ViewMode } from "../authorView";

interface SourceEntry { ref: ConditionRef; data: SourceMaterial }

const INTRO_KEY = "cg_guided_intro_seen";
const REVIEW_SCREEN = "3.2";
const PROVENANCE_SCREEN = "1.5";
const SAFETY_SCREEN = "3.1";

// One overlay, shown once. It used to be two — a cadre question, then an
// introduction — which meant a first-time author hit two modals before
// reaching a single clinical question. Cadre is a one-line field at the
// bottom of the introduction now, and the whole thing is gone for good once
// the author has seen it and has a cadre on record.
function StartOverlay({ needsCadre, onStart }: {
  needsCadre: boolean;
  onStart: (view: ViewMode, cadre: { cadre: string; other: string | null } | null) => Promise<void>;
}) {
  const [cadre, setCadre] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !needsCadre || (!!cadre && (cadre !== "Other" || !!other.trim()));

  async function start(view: ViewMode) {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(view, needsCadre ? { cadre, other: cadre === "Other" ? other.trim() : null } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-7 shadow-xl">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">Authoring, one question at a time</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-neutral-600">
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>You'll write a clinical question, then mark what a correct answer must include. One question per screen.</li>
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>Move around freely. Everything saves as you go, so you can stop and come back.</li>
          <li className="flex gap-2.5"><span className="text-brand-600">•</span>Stuck? Use the note link under any screen and keep going.</li>
        </ul>

        {needsCadre && (
          <div className="mt-6">
            <label className="cg-label">Your current cadre</label>
            <p className="cg-help -mt-0.5 mb-1.5">Asked once. Reported in the paper as the mix of contributing authors.</p>
            <select value={cadre} onChange={(e) => setCadre(e.target.value)} className="cg-input w-full">
              <option value="" disabled>Select your cadre…</option>
              {CADRES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {cadre === "Other" && (
              <input
                type="text"
                autoFocus
                className="cg-input mt-3 w-full"
                placeholder="Please specify"
                value={other}
                onChange={(e) => setOther(e.target.value)}
              />
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => start("form")}
            disabled={!ready || busy}
            className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 disabled:opacity-40"
          >
            Prefer the full form?
          </button>
          <button onClick={() => start("guided")} disabled={!ready || busy} className="cg-btn-primary px-6 disabled:opacity-50">
            {busy ? "Saving…" : "Start authoring"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Authoring() {
  const { user, refresh } = useAuth();
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
  const [sidebarTab, setSidebarTab] = useState<"source" | "preview">(() =>
    sessionStorage.getItem("cg_sidebar_tab") === "preview" ? "preview" : "source");
  const [view, setView] = useState<ViewMode>(getAuthorView);
  const [introSeen, setIntroSeen] = useState(() => !!localStorage.getItem(INTRO_KEY));

  // The switch also lives in the nav hamburger on a phone (see authorView.ts).
  useEffect(() => subscribeAuthorView(setView), []);

  // Guided-flow position lives in the URL (?screen=2.3) so a specific question
  // can be shared for review. Invalid/absent falls back to the first screen.
  const screenParam = searchParams.get("screen");
  // Accepts both a step id ("2.more") and any individual question id ("2.5") —
  // optional-question deep links still resolve, into their group. See flow.ts.
  const screenId = screenParam && isValidFlowParam(screenParam) ? screenParam : FLOW_STEPS[0].id;
  const goTo = (id: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("screen", id);
      return p;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setViewMode = (v: ViewMode) => { setView(v); setAuthorView(v); };

  useEffect(() => { sessionStorage.setItem("cg_show_source", showPanel ? "1" : "0"); }, [showPanel]);
  useEffect(() => { sessionStorage.setItem("cg_sidebar_tab", sidebarTab); }, [sidebarTab]);

  // One analytics tag per internal screen id, so drop-off is measurable per
  // question rather than per page. A no-op wherever Clarity isn't loaded.
  useEffect(() => {
    if (view !== "guided") return;
    window.clarity?.("set", "cg_screen", screenId);
  }, [screenId, view]);

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
    // An untouched visit leaves nothing behind. This effect fires once on load
    // with a pristine form, so without the guard, merely opening a condition
    // and backing out wrote a draft — which then showed up as an unfinished
    // case the author never started, and made the header claim "Saved" with
    // nothing typed. Clearing covers a draft the author has just emptied out.
    if (isBlank(form)) {
      clearDraft(slug);
      setSavedAt(null);
      setSaveKind("none");
      return;
    }
    setSavedAt(saveDraft(slug, form, screenId));
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
  // Full detail lives in the tooltip; the visible indicator is just a dot and
  // a word — "is it saved?" is binary, the timestamp is noise mid-flow.
  const saveIndicator =
    saveKind === "auto" && savedAt ? `Auto-saved at ${fmtTime(savedAt)}`
    : saveKind === "submitted" && savedAt ? `${isEdit ? "Saved" : "Submitted"} at ${fmtTime(savedAt)}`
    : isEdit ? "No unsaved changes" : "Not yet saved";
  const saveShort =
    saveKind === "auto" ? "Saved"
    : saveKind === "submitted" ? (isEdit ? "Saved" : "Submitted")
    : isEdit ? "Saved" : "Not saved";
  const saveDot = saveKind === "none" && !isEdit ? "bg-neutral-300" : "bg-brand-500";

  const names = useMemo(() => (sources.data ?? []).map((s) => s.data.condition.name), [sources.data]);

  const payload = useMemo(() => toPayload(form, refs), [form, refs]);

  // Where a friction note would land: flow position (guided screen or full
  // form) plus which case, so repeated confusions map back to a screen/field.
  const currentScreen = screenById(screenId);
  const currentStep = FLOW_STEPS[stepIndexForScreen(screenId)];
  const crumb = currentScreen?.crumb ?? (currentStep?.kind === "enrichment" ? "More detail" : "?");
  const noteContext =
    (isEdit ? `edit case ${editCaseId} · ` : "") +
    (view === "guided" ? `screen ${screenId} (${crumb})` : "full form");

  // Which guideline section the panel should be showing. A grouped step takes
  // the mapping of the first question inside it.
  const panelKind = view !== "guided"
    ? null
    : currentScreen?.kind
      ?? (currentStep?.kind === "enrichment" ? groupScreens(currentStep.groups[0])[0]?.kind ?? null : null);
  const openSections = useMemo(() => sourceSectionsFor(panelKind), [panelKind]);

  async function startAuthoring(v: ViewMode, cadre: { cadre: string; other: string | null } | null) {
    if (cadre) {
      await api.setCadre(cadre.cadre, cadre.other);
      await refresh();
    }
    localStorage.setItem(INTRO_KEY, "1");
    setIntroSeen(true);
    if (v !== view) setViewMode(v);
  }

  async function submit() {
    // No client-side gating (v1.3.1 §4) except the two questions that must be
    // actively answered: harm (ADR-029) and provenance (ADR-033). Checked
    // before the request so neither round-trips to the server unresolved.
    if (!safetyAnswered(form)) {
      setIssues([{ message: SAFETY_PROMPT, screenId: SAFETY_SCREEN }]);
      if (view === "guided") goTo(SAFETY_SCREEN);
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!provenanceAnswered(form)) {
      setIssues([{
        message: form.guideline_provenance ? PROVENANCE_NOTES_PROMPT : PROVENANCE_PROMPT,
        screenId: PROVENANCE_SCREEN,
      }]);
      if (view === "guided") goTo(PROVENANCE_SCREEN);
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
      else setIssues([{ message: e instanceof Error ? e.message : "Submission failed." , screenId: null }]);
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
        {([["source", "NSTG guideline"], ["preview", "Case preview"]] as const).map(([key, label]) => (
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
            <SourcePanel
              data={sources.data?.[activeTab]?.data ?? null}
              loading={sources.loading}
              error={sources.error}
              openSections={openSections}
              resetKey={`${activeTab}:${panelKind ?? "none"}`}
            />
          </div>
        </>
      )}
    </div>
  );

  // Room for the fixed phone navigation bar, so the note link below the card
  // stays reachable and nothing sits under the primary action.
  return (
    <div className="relative mx-auto flex w-full max-w-7xl gap-5 px-6 py-6 pb-28 lg:pb-6">
      <div className={showPanel ? "w-full lg:w-[60%]" : "mx-auto w-full max-w-3xl"}>
        {/* Sticky header bar */}
        <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50/90 px-4 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-base font-semibold text-neutral-900">{names.length ? names.join(", ") : "Loading…"}</h1>
            {/* The one line under the title is the draft state (with its only
                escape hatch), not the user's own name — they know who they are. */}
            {loadedDraftAt && (
              <p className="truncate text-xs text-neutral-400">
                Resumed draft from {fmtTime(loadedDraftAt)}{" · "}
                <button onClick={discardDraft} className="underline underline-offset-2 hover:text-neutral-600">
                  discard and start fresh
                </button>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* View switch: guided (default) vs full form. On a phone this
                lives in the nav hamburger instead — there is no room for it
                beside the condition name. */}
            <div className="hidden rounded-lg border border-neutral-200 bg-white p-0.5 lg:flex">
              {([["guided", "Guided"], ["form", "Full form"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setViewMode(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === key ? "bg-brand-700 text-white" : "text-neutral-500 hover:bg-neutral-100"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex" title={saveIndicator}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveDot}`} />{saveShort}
            </span>
            <button onClick={() => setShowPanel((s) => !s)} className="cg-btn-ghost hidden px-2 py-1 text-xs lg:inline-flex">{showPanel ? "Hide source" : "Show source"}</button>
          </div>
        </div>

        {view === "form" && issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-medium">Please fix:</p>
            <ul className="list-disc space-y-0.5 pl-5">{issues.map((iss, i) => <li key={i}>{iss.message}</li>)}</ul>
          </div>
        )}

        {view === "guided" ? (
          <GuidedFlow
            form={form} set={set}
            screenId={screenId} goTo={goTo}
            toggleArchetype={toggleArchetype}
            onSubmit={submit} submitting={submitting} issues={issues}
            onOpenSource={() => setMobileOpen(true)}
          />
        ) : (
          <FullForm
            form={form} set={set}
            toggleArchetype={toggleArchetype}
            onSubmit={submit} submitting={submitting}
            onOpenSource={() => setMobileOpen(true)}
          />
        )}

        {/* In the document flow (not floating) so it can never cover content
            on mobile; context tracks the current screen/view. */}
        <div className="mt-4 px-1">
          <NoteLink flow="authoring" context={noteContext} />
        </div>
      </div>

      {showPanel && (
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[40%] overflow-hidden rounded-lg border border-neutral-200 bg-white lg:block">
          {sourceArea}
        </aside>
      )}

      {/* One overlay, once: the introduction, carrying the cadre question for
          an author who hasn't answered it. */}
      {user && (!introSeen || !user.cadre) && (
        <StartOverlay needsCadre={!user.cadre} onStart={startAuthoring} />
      )}

      <div className={`fixed inset-0 z-40 transform bg-white transition-transform duration-200 ease-out lg:hidden ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <button onClick={() => setMobileOpen(false)} className="cg-btn-ghost m-2 self-end">✕ Close</button>
          <div className="min-h-0 flex-1">{sourceArea}</div>
        </div>
      </div>
    </div>
  );
}

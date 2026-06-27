// Public methodology page. Long-form, same typographic style as the landing page.
// Content is grounded in docs/methodology.md (real variance figures, scoring
// formula) — no fabricated numbers.

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";
const METHODOLOGY_DOC = `${GITHUB_URL}/blob/main/docs/methodology.md`;
const BLOG_URL = "https://medium.com/@mujeebopabode07/the-eval-was-wrong-not-the-ai-041869fad2f7";

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-brand-700">
      {children}
    </a>
  );
}

function Sec({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-neutral-200 py-9">
      <h2 className="mb-4 font-serif text-2xl font-semibold text-neutral-900">{title}</h2>
      <div className="space-y-4 text-[17px] leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export function Methodology() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16">
      <header className="py-12">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-neutral-900">Evaluation methodology</h1>
        <p className="prose-measure mt-3 text-lg leading-relaxed text-neutral-600">
          How ClinicalGuard constructs ground truth, scores clinical AI responses, and what it
          honestly does and does not claim. Approximately a 10-minute read.
        </p>
      </header>

      <Sec id="overview" title="1. Overview">
        <p>
          ClinicalGuard evaluates whether a clinical AI response adheres to a specific clinical
          guideline in a specific deployment context — not whether it recalls medical facts in the
          abstract. This document describes the Phase A methodology: how evaluation cases are
          framed and authored, how responses are scored across four dimensions, what reliability we
          have measured, and the limitations we are explicit about. It is a living document; the
          technical detail and measurement artifacts live in the <A href={METHODOLOGY_DOC}>repository methodology doc</A>.
        </p>
      </Sec>

      <Sec id="query" title="2. Query construction">
        <p>
          In Phase A the physician authors free-text clinical queries after consulting external
          source material — primarily Nigerian medical examination materials, supplemented with WHO
          and specialty-society guideline case examples. A query is a realistic clinical scenario
          the AI is asked to respond to; it tests reasoning, not recall.
        </p>
        <p>
          We deliberately do <em>not</em> templatize clinical content. Prescribing the symptoms,
          findings, or diagnosis of a case would anchor the author to a fixed shape and narrow the
          corpus. We <em>do</em> templatize the <strong className="font-semibold text-neutral-900">reasoning
          pattern</strong>: seven canonical archetypes (plus an open "Other") — missing-context
          recognition, severity stratification, contraindication navigation, overlapping-presentation
          differentiation, critical red-flag recognition, first-line protocol adherence, and referral
          and escalation per protocol. The author selects archetypes first, then writes a query that
          exercises them. This nudges corpus coverage toward diverse failure modes without dictating
          what any individual case says.
        </p>
        <p>
          This sits between existing approaches. NOHARM <A href="https://arxiv.org/abs/2512.01241">[2]</A>
          {" "}draws cases from real consultations; HealthBench <A href="https://arxiv.org/abs/2505.08775">[3]</A>
          {" "}synthesizes conversations from situation seeds; MedQA <A href="https://arxiv.org/abs/2009.13081">[4]</A>
          {" "}scrapes examination banks. ClinicalGuard's archetype nudge is closest in spirit to
          HealthBench's situation seeds, applied to physician-authored, guideline-grounded cases.
        </p>
      </Sec>

      <Sec id="ground-truth" title="3. Ground truth authoring">
        <p>
          A physician authors the ground truth directly through a structured form. No LLM is in the
          ground-truth path in Phase A — the case is not generated and then reviewed; it is written
          by hand from the structured guideline data the framework surfaces.
        </p>
        <p>
          Each element is sorted into a tier. <strong className="font-semibold text-neutral-900">Required</strong> elements
          are those whose omission would constitute clinical failure. <strong className="font-semibold text-neutral-900">Expected</strong> elements
          a thorough response should include but whose absence does not harm the patient.
          <strong className="font-semibold text-neutral-900"> Situational</strong> elements are required only when a stated
          trigger appears in the AI response — for example, CSF analysis becomes required if the AI
          raises meningitis as a differential. Triggers are written so a reviewer can tell whether
          they fired in any given response, and the scorer penalizes inconsistency (raising a concern
          without following through).
        </p>
        <p>
          The form is, in effect, a structured scoring rubric — which is how serious physician-panel
          work is done. ClinicalGuard's contribution is not a novel rubric but its open-source
          reusability and its design for <em>distributed individual contribution</em>: an MD can
          author cases alone, asynchronously, rather than requiring a coordinated panel convened in
          one place.
        </p>
      </Sec>

      <Sec id="scoring" title="4. Scoring methodology">
        <p>
          Responses are scored across four dimensions reported separately, so aggregate scores never
          hide tradeoffs: treatment correctness, investigation appropriateness, completeness, and
          safety adherence. The first three are LLM-judged with claim-level traceability; safety
          adherence uses a deterministic formula over LLM-based rule detection.
        </p>
        <p>
          Each LLM-judged dimension combines critical coverage and thoroughness:
        </p>
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-800">
          dimension_score = 0.75 × critical_coverage + 0.25 × thoroughness
        </p>
        <p>
          Critical coverage (near-binary) measures how fully required elements were addressed;
          thoroughness (graduated) measures how many expected-but-not-required elements were
          addressed. The 75/25 weighting encodes that missing critical elements should dominate the
          score. It is a deliberate design choice, <strong className="font-semibold text-neutral-900">not yet
          empirically tuned</strong> — sensitivity analysis on alternative weightings and physician-panel
          calibration are planned. Communication quality (how a response is conveyed to a clinician or
          patient) is a known gap and is deferred to v2.0; it would require recalibrating the scorer.
        </p>
      </Sec>

      <Sec id="variance" title="5. Variance and reliability">
        <p>
          We measured judge variance across 10 runs per case at temperature 0 on the three
          hand-authored reference cases. Two cases (severe malaria, newly-diagnosed T2DM) are stable
          (overall σ ≤ 0.023). The hypertension case is unstable (overall σ = 0.131): its
          NSTG-specific monotherapy constraint for Black patients sits at a boundary judgment that
          gpt-4o-mini does not resolve consistently. Dimension correlations (30 observations) are
          driven almost entirely by that one unstable case — they are descriptive of current
          measurement conditions, not structural validation of the four-dimension design. A larger
          case set is needed before making independence claims.
        </p>
        <p>
          The intended reliability path is multi-judge, cross-family concordance scoring, drawing on
          the appropriateness-rating tradition used in physician-panel work (RAND/UCLA) and NOHARM's
          multi-annotator approach. Full measurement data is in the{" "}
          <A href={METHODOLOGY_DOC}>repository methodology doc</A>.
        </p>
      </Sec>

      <Sec id="limitations" title="6. Acknowledged limitations">
        <ul className="list-disc space-y-2 pl-6">
          <li>The Phase A corpus is small and authored by two MDs only; a broader contributor pool comes in Phase D.</li>
          <li>Communication quality is not currently scored.</li>
          <li>Cases are not yet validated against real clinical AI deployments.</li>
          <li>Coverage may skew toward common conditions; stratified sampling is planned.</li>
          <li>One author (Mujeeb) is nine months post-graduation and not in current clinical practice; the second-reviewer design partly mitigates this.</li>
          <li>Safety-rule coverage is narrow (9 verified rules across 5 of 251 conditions) and currently commission-focused, despite omission driving most severe harm.</li>
          <li>The framework depends on physicians willing to contribute their time — a real constraint, not a solved problem.</li>
        </ul>
      </Sec>

      <Sec id="contributes" title="7. What ClinicalGuard contributes">
        <p>What it offers:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Open-source, reusable infrastructure for guideline-grounded clinical AI evaluation.</li>
          <li>A contribution model resource-constrained teams can actually mount — distributed individual contribution rather than coordinated panels.</li>
          <li>Failures that trace to specific guideline provisions, enabling deployment-context evaluation.</li>
          <li>A public corpus of MD-authored cases grounded in Nigerian clinical guidelines.</li>
        </ul>
        <p>What it does not claim:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>To be more rigorous than a 29-physician panel.</li>
          <li>To remove the need for credentialed contributors.</li>
          <li>To make panel work cheap.</li>
        </ul>
      </Sec>

      <Sec id="references" title="8. References">
        <ol className="list-decimal space-y-2 pl-6 text-[15px] text-neutral-600">
          <li>Korom et al. Safety of an LLM-based clinical decision support system in African primary healthcare. <A href="https://www.nature.com/articles/s44360-026-00082-5">Nature Health, 2026</A>.</li>
          <li>Wu et al. First, do NOHARM: towards clinically safe large language models. <A href="https://arxiv.org/abs/2512.01241">arXiv:2512.01241</A>.</li>
          <li>Arora et al. HealthBench. <A href="https://arxiv.org/abs/2505.08775">arXiv:2505.08775</A>.</li>
          <li>Jin et al. What disease does this patient have? (MedQA). <A href="https://arxiv.org/abs/2009.13081">arXiv:2009.13081</A>, 2020.</li>
          <li><A href={BLOG_URL}>The eval was wrong, not the AI</A> — essay on why evaluation is the bottleneck for clinical AI.</li>
        </ol>
      </Sec>
    </div>
  );
}

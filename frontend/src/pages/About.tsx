// The framework/research page: everything that used to sit on the landing page
// ahead of the clinician's task — the three-layer architecture, the research
// citations, the roadmap. Kept in full for researchers and outreach contacts
// arriving for the detail; one link away from the clinician's path.

import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";
const ADR_URL = `${GITHUB_URL}/tree/main/docs/adr`;
const BLOG_URL = "https://medium.com/@mujeebopabode07/the-eval-was-wrong-not-the-ai-041869fad2f7";
const PENDA_URL = "https://www.nature.com/articles/s44360-026-00082-5";
const NOHARM_URL = "https://arxiv.org/abs/2512.01241";

function Cite({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-brand-700">
      {children}
    </a>
  );
}

function Section({ id, title, children }: { id?: string; title?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-neutral-200 py-12">
      {title && <h2 className="mb-5 font-serif text-2xl font-semibold text-neutral-900">{title}</h2>}
      <div className="prose-measure space-y-4 text-[17px] leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export function About() {
  const conditions = useFetch(() => api.listConditions(), []);
  const safety = useFetch(() => api.safetyRules(), []);
  const cases = useFetch(() => api.evalCaseCount(), []);

  const nConditions = conditions.data ? conditions.data.length : "251";
  const nSafety = safety.data ? safety.data.length : "9";
  const nCases = cases.data ? String(cases.data.count) : "…";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <header className="py-10 sm:py-14">
        <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">← Back</Link>
        <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-neutral-900">The framework</h1>
        <p className="prose-measure mt-4 text-xl leading-relaxed text-neutral-600">
          A framework for evaluating clinical AI systems against structured clinical guidelines and
          deployment-specific rules.
        </p>
      </header>

      <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-neutral-200 py-3 text-sm text-neutral-500">
        {[
          ["#why", "Why this matters"],
          ["#framework", "The framework"],
          ["#status", "Current status"],
          ["#roadmap", "Roadmap"],
          ["#contribute", "How to contribute"],
          ["#resources", "Resources"],
        ].map(([href, label], i) => (
          <span key={href} className="flex items-center gap-x-3">
            {i > 0 && <span aria-hidden className="text-neutral-300">·</span>}
            <a href={href} className="hover:text-brand-700">{label}</a>
          </span>
        ))}
      </nav>

      <Section id="why" title="Why this matters">
        <p>
          Clinical AI is being deployed where the consequences of error are serious. Recent research
          documents two specific failure modes that most evaluation does not catch.
        </p>
        <div className="not-prose my-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="font-serif text-3xl font-bold text-neutral-900">~4×</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              In a 1,469-encounter evaluation across 16 Kenyan primary care clinics, clinicians
              adopted <strong className="font-semibold text-neutral-900">harmful</strong> AI
              recommendations at roughly four times the rate of beneficial ones — and ignored
              beneficial guidance entirely in 25% of encounters.
            </p>
            <p className="mt-2 text-xs text-neutral-400"><Cite href={PENDA_URL}>Korom et al., Nature Health 2026 [1]</Cite></p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="font-serif text-3xl font-bold text-neutral-900">76.6%</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Across 12,747 physician annotations, 76.6% of <strong className="font-semibold text-neutral-900">severely
              harmful</strong> errors in clinical LLM outputs came from omission — what the AI failed
              to say — not from recommending harmful actions.
            </p>
            <p className="mt-2 text-xs text-neutral-400"><Cite href={NOHARM_URL}>Wu et al., NOHARM, arXiv:2512.01241 [2]</Cite></p>
          </div>
        </div>
        <p>
          Most clinical AI evaluation today is not designed to catch these failure modes. It either
          does not exist, uses circular LLM-as-judge approaches that grade models against themselves,
          or relies on generic benchmarks that test medical knowledge without testing whether the AI
          follows the specific guidelines a deployment is built on. Physician panel validation is the
          gold standard but inaccessible to most teams building clinical AI in resource-constrained
          settings. ClinicalGuard proposes a credible intermediate path: a structured workflow for
          MD-authored ground truth grounded in specific guidelines, designed to be feasible for teams
          that cannot afford physician panels.
        </p>
        <p className="text-base text-neutral-500">
          More on why evaluation is the bottleneck for clinical AI:{" "}
          <Cite href={BLOG_URL}>The eval was wrong, not the AI</Cite>.
        </p>
      </Section>

      <Section id="framework" title="The framework">
        <p>
          ClinicalGuard is designed around the recognition that clinical AI evaluation requires
          grounding in three layers: the clinical guidelines being followed, safety rules that
          augment those guidelines with high-stakes constraints, and the deployment-specific context
          where the AI actually operates. The framework is built to support all three layers, though
          current implementation focuses on the first two.
        </p>

        <div className="not-prose my-6 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-sm sm:grid-cols-3">
          {[
            { n: "1", t: "Guideline layer", s: "Implemented" },
            { n: "2", t: "Safety layer", s: "Implemented" },
            { n: "3", t: "Context layer", s: "Roadmapped" },
          ].map((l) => (
            <div key={l.n} className="bg-neutral-50 p-4">
              <div className="font-mono text-xs text-neutral-400">Layer {l.n}</div>
              <div className="mt-1 font-serif text-base font-semibold text-neutral-900">{l.t}</div>
              <div className="mt-1 text-xs text-neutral-500">{l.s}</div>
            </div>
          ))}
        </div>

        <p>
          <strong className="font-semibold text-neutral-900">The guideline layer</strong> ingests
          structured clinical guidelines into a normalized schema. Findings, treatments,
          investigations, differentials, complications, and safety signals are extracted into
          queryable structured data. The first guideline supported is the Nigeria Standard Treatment
          Guidelines (NSTG 2022), with {nConditions} conditions ingested. The framework's
          architecture supports other reference-style guidelines (WHO Standard Treatment Guidelines,
          NICE guidelines, other national treatment guidelines) and is designed to be extended.
        </p>
        <p>
          <strong className="font-semibold text-neutral-900">The safety layer</strong> is a curated
          set of rules that sits on top of the guideline ingestion, encoding high-stakes constraints
          the AI should respect — drug contraindications, dangerous combinations, population-specific
          warnings such as pregnancy, pediatric, or renal impairment. Each rule is traceable to its
          source provision in the guideline and is reviewed by an MD before activation. The framework
          currently has {nSafety} active verified safety rules.
        </p>
        <p>
          <strong className="font-semibold text-neutral-900">The context layer</strong> grounds
          evaluation in the institutional constraints real deployments operate within — what drugs
          are on the formulary, what equipment is available, what protocols the institution mandates.
          The framework's architecture supports ingestion of these institutional rules and contextual
          scoring against them. This is the layer that makes evaluation match where the AI actually
          operates rather than where the guideline author imagined. Implementation of this layer is
          roadmapped for future work with institutional partners.
        </p>
      </Section>

      <Section id="status" title="Current status">
        <div className="not-prose grid grid-cols-3 gap-4">
          {[
            [nConditions, "NSTG conditions ingested"],
            [nSafety, "Verified safety rules"],
            [nCases, "Cases authored"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg border border-neutral-200 bg-white p-5 text-center">
              <div className="font-serif text-3xl font-bold text-brand-700">{value}</div>
              <div className="mt-1 text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4">
          The first batch of NSTG-derived cases is being authored now, by contributing physicians
          alongside the two reviewers.
        </p>
      </Section>

      <Section id="roadmap" title="Roadmap">
        <div className="not-prose overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-4 align-bottom">Phase</th>
                <th className="py-2 pr-4 align-bottom">Status</th>
                <th className="py-2 align-bottom">What it is</th>
              </tr>
            </thead>
            <tbody className="align-top text-neutral-700">
              {[
                ["Phase B", "In progress", "Case corpus building. Authoring of NSTG-derived eval cases, targeting the first batch of 10 to 15 cases."],
                ["Phase C", "Next", "Methodology paper. Documents the workflow, the corpus, the design decisions, and the honest limits. Released open-source alongside the framework."],
                ["Phase D", "After C", "Moderated review pipeline. Review queues and inter-rater agreement tracking on top of the authoring flow. The evaluation dashboard for running cases against AI systems will ship in this phase."],
                ["Phase E", "Longer term", "Cross-guideline support. Extending the framework to ingest WHO Standard Treatment Guidelines, NICE guidelines, and other national/international guidelines."],
                ["Context layer", "Pending institutional partner", "The deployment-context grounding layer is roadmapped pending real institutional partnerships. The architecture supports it; the implementation awaits actual deployment contexts to design against."],
              ].map(([phase, status, what]) => (
                <tr key={phase} className="border-b border-neutral-200">
                  <td className="py-3 pr-4 font-medium text-neutral-900 whitespace-nowrap">{phase}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${
                      status === "In progress" ? "border-brand-200 bg-brand-50 text-brand-700"
                      : status === "Next" || status === "After C" ? "border-neutral-200 bg-neutral-100 text-neutral-600"
                      : "border-neutral-200 bg-neutral-50 text-neutral-400"
                    }`}>{status}</span>
                  </td>
                  <td className="py-3 leading-relaxed">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="contribute" title="How to contribute">
        <p>
          ClinicalGuard's value depends on physicians authoring high-quality evaluation cases
          grounded in the clinical guidelines they know. Case authoring is open now — you can start
          from the <Link to="/author" className="text-brand-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-brand-700">authoring page</Link>.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong className="font-semibold text-neutral-900">Case authoring</strong> — MDs author evaluation cases for conditions they have clinical expertise in.</li>
          <li><strong className="font-semibold text-neutral-900">Case review</strong> — MDs independently review cases authored by others, providing second-reviewer validation.</li>
          <li><strong className="font-semibold text-neutral-900">Methodology contribution</strong> — Experienced contributors propose changes to case structure, scoring dimensions, or workflow itself.</li>
        </ul>
        <p>
          Contributors receive named credit on the framework, co-authorship on the methodology paper
          for substantive contributions, and a public artifact for their own clinical AI work.
        </p>
      </Section>

      <Section id="resources" title="Resources">
        <ul className="not-prose space-y-3 text-[15px]">
          <li>
            <Link to="/methodology" className="text-brand-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-brand-700">Methodology</Link>
            <span className="text-neutral-500"> — how cases are framed and authored, the scoring rubric, measured variance, and acknowledged limitations.</span>
          </li>
          <li>
            <Cite href={BLOG_URL}>The eval was wrong, not the AI</Cite>
            <span className="text-neutral-500"> — why clinical AI evaluation is the constraining problem for safe deployment, and what guideline-grounded evaluation looks like.</span>
          </li>
          <li>
            <Cite href={ADR_URL}>Architecture decisions</Cite>
            <span className="text-neutral-500"> — all architectural decisions documented as ADRs.</span>
          </li>
          <li>
            <Cite href={GITHUB_URL}>Source code</Cite>
            <span className="text-neutral-500"> — the framework repository.</span>
          </li>
          <li>
            <Cite href={GITHUB_URL}>Contact</Cite>
            <span className="text-neutral-500"> — via GitHub (hemjay07).</span>
          </li>
        </ul>
      </Section>

      <footer className="border-t border-neutral-200 pt-8 text-sm text-neutral-500">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/methodology" className="hover:text-brand-700">Methodology</Link>
          <Cite href={GITHUB_URL}>GitHub</Cite>
          <Cite href={ADR_URL}>ADRs</Cite>
        </div>
        <p>MIT License.</p>
        <p className="mt-1">
          Mujeeb Opabode, MD (University of Ibadan, 2025) · Abdulquddus Ajibade, MD (Senior AI
          Engineer at Ciba Health)
        </p>
      </footer>
    </div>
  );
}

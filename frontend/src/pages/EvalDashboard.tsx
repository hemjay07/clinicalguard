import { PageContainer } from "../components/ui";

const METHODOLOGY_URL = "https://github.com/hemjay07/clinicalguard/blob/main/docs/methodology.md";

export function EvalDashboard() {
  return (
    <PageContainer>
      <article className="mx-auto max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold text-neutral-900">Evaluation Dashboard</h1>
        <p className="mt-2 italic text-neutral-500">Coming in Phase D.</p>

        <p className="mt-6 leading-relaxed text-neutral-700">
          The evaluation dashboard will let teams run their clinical AI systems against the case
          corpus and view scores across four dimensions: treatment correctness, investigation
          appropriateness, completeness, and safety adherence. Teams will be able to track
          regression over time and compare model versions.
        </p>

        <p className="mt-4 leading-relaxed text-neutral-700">
          The backend scoring infrastructure is built and operational and is currently driven via
          Python scripts. The frontend dashboard is roadmapped for Phase D, when the case corpus
          reaches sufficient size to make systematic evaluation meaningful.
        </p>

        <p className="mt-6">
          <a href={METHODOLOGY_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
            View methodology document →
          </a>
        </p>
      </article>
    </PageContainer>
  );
}

// The clinician's landing page. One job: tell an invited physician, in one
// read on a phone, what they personally do and why — then get them into the
// authoring flow. Framework architecture, research citations and the roadmap
// live on /about, one link away, for researchers arriving from outreach.

import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";
const BLOG_URL = "https://medium.com/@mujeebopabode07/the-eval-was-wrong-not-the-ai-041869fad2f7";

// Honest current estimate for one case, end to end. Update when the flow is
// shortened — it is the number the invitation is judged against.
const AUTHORING_TIME = "20 to 30";

function Cta({ className = "" }: { className?: string }) {
  return (
    <Link to="/author" className={`cg-btn-primary inline-flex px-6 py-3 text-base ${className}`}>
      Author a case
    </Link>
  );
}

export function Home() {
  const cases = useFetch(() => api.evalCaseCount(), []);
  const conditions = useFetch(() => api.listConditions(), []);
  const nCases = cases.data ? String(cases.data.count) : "…";
  const nConditions = conditions.data ? conditions.data.length : "251";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 sm:px-6">
      {/* Hero */}
      {/* No wordmark here — the sticky nav bar already carries it. */}
      <header className="pt-10 sm:pt-14">
        <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
          Help test whether medical AI is safe to trust.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-neutral-700">
          You write a clinical question for an AI to answer, then a marking scheme for the ideal
          response: what a good answer must include, and what it must never get wrong. We use these
          to test whether AI systems follow the standard of care where they'd actually be used.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-neutral-700">
          It takes about {AUTHORING_TIME} minutes, on your phone or laptop. Your progress saves as
          you go, so you can stop and come back whenever you like. It's the clinical reasoning you
          already do every day.
        </p>
        <div className="mt-7">
          <Cta />
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          Take your time. One careful case is worth more than several rushed ones.
        </p>
      </header>

      {/* Why it matters */}
      <section className="mt-12 border-t border-neutral-200 pt-9">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">Why it matters</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-neutral-700">
          Medical AI is already being used where mistakes are serious, and most of it is barely
          tested against the guidelines it's meant to follow. Your marking scheme becomes part of how
          we check whether these systems are actually safe, in a Nigerian context, against Nigerian
          guidelines.
        </p>
      </section>

      {/* What you'll do */}
      <section className="mt-10 border-t border-neutral-200 pt-9">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">What you'll do</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-neutral-700">
          You'll <strong className="font-semibold text-neutral-900">write</strong> a realistic
          clinical question, then mark what a correct response must include: the diagnosis, the key
          investigations and treatments, and above all the safety points: the things an AI
          must never miss or get wrong. Base it on the kind of patient you see, with the details
          changed so no real person can be identified.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-neutral-700">
          The Nigerian treatment guideline (NSTG) sits beside you as you work. Where the guideline is
          thin, add from your own clinical judgment and note where it came from.
        </p>
        <div className="mt-7">
          <Cta />
        </div>
      </section>

      {/* Recognition */}
      <section className="mt-10 border-t border-neutral-200 pt-9">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">Recognition</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-neutral-700">
          Everyone whose case is accepted into the study is named in the acknowledgements of the
          research paper.
        </p>
      </section>

      {/* One small stat line — proof of life, not a dashboard. */}
      <p className="mt-10 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
        {nConditions} NSTG conditions available to author from · {nCases} cases authored so far
      </p>

      {/* The single door to the deep content. */}
      <p className="mt-4 text-sm text-neutral-500">
        Curious about the framework, methodology, and roadmap?{" "}
        <Link to="/about" className="text-brand-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-brand-700">
          Read more
        </Link>
      </p>

      {/* Who's behind this */}
      <section className="mt-10 border-t border-neutral-200 pt-9">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">Who's behind this</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-neutral-700">
          ClinicalGuard is an open-source project by Dr Abdulmujeeb Opabode (MBBS, Ibadan), built
          with Nigerian doctors who write and review the cases.
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-neutral-200 pt-8 text-sm text-neutral-500">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/about" className="hover:text-brand-700">The framework</Link>
          <Link to="/methodology" className="hover:text-brand-700">Methodology</Link>
          <a href={BLOG_URL} target="_blank" rel="noreferrer" className="hover:text-brand-700">Blog</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-brand-700">GitHub</a>
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

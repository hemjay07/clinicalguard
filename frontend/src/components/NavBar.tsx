import { NavLink, Link, useLocation } from "react-router-dom";

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";

// Ordered by the MD's journey: land → see the corpus → browse the reference
// material behind it → read how it's scored. Authoring is the one primary
// action, so it lives as a CTA on the right instead of a peer link.
const links = [
  { to: "/", label: "Home", end: true },
  { to: "/cases", label: "Cases" },
  { to: "/conditions", label: "Conditions" },
  { to: "/safety-rules", label: "Safety rules" },
  { to: "/methodology", label: "Methodology" },
  { to: "/eval-dashboard", label: "Eval dashboard" },
];

export function NavBar() {
  // Don't advertise "Author a case" while the user is already authoring one.
  const authoring = useLocation().pathname.startsWith("/author");
  return (
    <header className="border-b border-neutral-200 bg-neutral-50/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5">
        <Link to="/" className="mr-3 font-serif text-lg font-semibold text-brand-700">ClinicalGuard</Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `border-b-2 pb-0.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-700 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="border-b-2 border-transparent pb-0.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
          >
            GitHub ↗
          </a>
          {!authoring && (
            <NavLink to="/author" className="cg-btn-primary px-4 py-1.5">
              Author a case
            </NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}

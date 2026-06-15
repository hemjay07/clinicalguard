import { NavLink } from "react-router-dom";

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/author", label: "Author Case" },
  { to: "/conditions", label: "Conditions" },
  { to: "/safety-rules", label: "Safety Rules" },
  { to: "/cases", label: "Submitted Cases" },
  { to: "/eval-dashboard", label: "Eval Dashboard" },
];

export function NavBar() {
  return (
    <header className="border-b border-neutral-200 bg-neutral-50/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4">
        <span className="mr-3 font-serif text-lg font-semibold text-brand-700">ClinicalGuard</span>
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
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto border-b-2 border-transparent pb-0.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  );
}

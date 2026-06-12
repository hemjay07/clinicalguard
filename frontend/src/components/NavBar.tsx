import { NavLink } from "react-router-dom";

const GITHUB_URL = "https://github.com/hemjay07/clinicalguard";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/author", label: "Author Case" },
  { to: "/conditions", label: "Conditions" },
  { to: "/safety-rules", label: "Safety Rules" },
  { to: "/cases", label: "Submitted Cases" },
];

export function NavBar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-semibold text-brand-700">ClinicalGuard</span>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `rounded px-3 py-1.5 text-sm font-medium ${
                isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
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
          className="ml-auto rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  );
}

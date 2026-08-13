import { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

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

function desktopLinkClass({ isActive }: { isActive: boolean }) {
  return `border-b-2 pb-0.5 text-sm font-medium transition-colors ${
    isActive
      ? "border-brand-700 text-neutral-900"
      : "border-transparent text-neutral-500 hover:text-neutral-900"
  }`;
}

function mobileLinkClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-4 py-3 text-base font-medium transition-colors ${
    isActive ? "bg-brand-50 text-brand-800" : "text-neutral-700 hover:bg-neutral-100"
  }`;
}

export function NavBar() {
  // Don't advertise "Author a case" while the user is already authoring one.
  const location = useLocation();
  const authoring = location.pathname.startsWith("/author");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Any navigation closes the sheet.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const taskLink = { to: "/decompose", label: "Rating task" };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-5 px-4 py-3 sm:py-3.5">
        <Link to="/" className="mr-1 font-serif text-lg font-semibold text-brand-700">ClinicalGuard</Link>

        {/* Desktop: one row of peer links; user + CTA on the right. */}
        <div className="hidden flex-1 items-center gap-5 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={desktopLinkClass}>
              {l.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to={taskLink.to} className={desktopLinkClass}>{taskLink.label}</NavLink>
          )}
          {user?.is_owner && (
            <NavLink to="/feedback" className={desktopLinkClass}>Feedback</NavLink>
          )}
          <div className="ml-auto flex items-center gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="border-b-2 border-transparent pb-0.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
            >
              GitHub ↗
            </a>
            {user ? (
              <span className="flex items-center gap-2.5 text-sm text-neutral-500">
                {user.display_name}
                <button
                  onClick={() => logout().then(() => navigate("/"))}
                  className="border-b-2 border-transparent pb-0.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Log out
                </button>
              </span>
            ) : (
              <NavLink to="/login" className="border-b-2 border-transparent pb-0.5 text-sm font-medium text-neutral-500 hover:text-neutral-900">
                Sign in
              </NavLink>
            )}
            {!authoring && (
              <NavLink to="/author" className="cg-btn-primary px-4 py-1.5">
                Author a case
              </NavLink>
            )}
          </div>
        </div>

        {/* Mobile: hamburger only. */}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            {open ? (
              <>
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile sheet — plain disclosure under the bar, 44px+ touch rows. */}
      {open && (
        <div className="cg-screen-enter border-t border-neutral-200 bg-neutral-50 px-3 pb-4 pt-2 lg:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={mobileLinkClass}>
              {l.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to={taskLink.to} className={mobileLinkClass}>{taskLink.label}</NavLink>
          )}
          {user?.is_owner && (
            <NavLink to="/feedback" className={mobileLinkClass}>Feedback</NavLink>
          )}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg px-4 py-3 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            GitHub ↗
          </a>

          <div className="mt-2 border-t border-neutral-200 px-1 pt-3">
            {!authoring && (
              <NavLink to="/author" className="cg-btn-primary w-full py-2.5">
                Author a case
              </NavLink>
            )}
            <div className="mt-3 flex items-center justify-between px-3 text-sm text-neutral-500">
              {user ? (
                <>
                  <span>{user.display_name}</span>
                  <button
                    onClick={() => logout().then(() => navigate("/"))}
                    className="rounded-lg px-3 py-2 font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <NavLink to="/login" className="w-full rounded-lg py-2 text-center font-medium text-brand-700 transition-colors hover:bg-neutral-100">
                  Sign in
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

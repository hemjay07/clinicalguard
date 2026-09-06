"""Generates docs/decomposition_rulebook.md from docs/decomposition_rulebook.yaml.

The YAML is the single authoritative source (see rulebook.py); this module
only renders it into a human-readable form for physicians and the
methodology paper. Never hand-edit the generated .md — edit the YAML and
re-run this module.

Usage: python -m clinicalguard.decomposition.render_markdown
"""

from pathlib import Path

from clinicalguard.decomposition.rulebook import DEFAULT_RULEBOOK_PATH, Rulebook, load_rulebook

DEFAULT_OUTPUT_PATH = Path("docs") / "decomposition_rulebook.md"

GENERATED_HEADER = (
    f"<!-- GENERATED FILE — DO NOT EDIT. Source: {DEFAULT_RULEBOOK_PATH.as_posix()} -->\n"
    f"<!-- Regenerate with: python -m clinicalguard.decomposition.render_markdown -->\n"
)


def render_markdown(rulebook: Rulebook) -> str:
    lines: list[str] = [GENERATED_HEADER]
    lines.append("# ClinicalGuard decomposition rulebook\n")
    lines.append(
        f"**Version {rulebook.version}** · last updated {rulebook.last_updated}\n"
    )
    lines.append(
        "Rules governing how bundled clinical rubric items are split into "
        "atomic scoring criteria. This document is not yet given to "
        "physician authors as instructions — see the changelog and the "
        "project's inter-rater measurement notes.\n"
    )

    lines.append("## Rules\n")
    ordered_rules = sorted(rulebook.rules, key=lambda r: (r.added_in_version, r.id))
    for rule in ordered_rules:
        lines.append(f"### {rule.prompt_heading}\n")
        lines.append(f"*Added in version {rule.added_in_version} · {rule.date_added}*\n")
        lines.append(f"**Statement.** {rule.statement}\n")
        lines.append(f"**Rationale.** {rule.rationale}\n")
        ex = rule.worked_example
        lines.append(
            f"**Worked example.** `{ex.item}`\n"
            f"→ {ex.decomposition}\n"
            f"— {ex.why}\n"
        )
        lines.append(f"**Origin.** {rule.origin}\n")

    if rulebook.constraints:
        lines.append("## Constraints\n")
        for c in rulebook.constraints:
            lines.append(f"- **{c.id}.** {c.statement}\n")

    if rulebook.open_rulings:
        lines.append("## Open rulings\n")
        lines.append(
            "Unresolved questions. Not applied in scoring or the "
            "decomposition prompt until a physician rules on them.\n"
        )
        for o in rulebook.open_rulings:
            lines.append(f"- **Question.** {o.question}")
            if o.context:
                lines.append(f"  **Context.** {o.context}")
            if o.current_lean:
                lines.append(f"  **Current lean.** {o.current_lean}")
            lines.append(f"  **Status.** {o.status}\n")

    if rulebook.changelog:
        lines.append("## Changelog\n")
        lines.append("| Version | Date | Change | Origin | Items affected |")
        lines.append("|---|---|---|---|---|")
        for entry in sorted(rulebook.changelog, key=lambda e: e.version):
            lines.append(
                f"| {entry.version} | {entry.date} | {entry.change} "
                f"| {entry.origin} | {entry.items_affected} |"
            )
        lines.append("")

    return "\n".join(lines)


def write_markdown(
    rulebook_path: Path = DEFAULT_RULEBOOK_PATH, output_path: Path = DEFAULT_OUTPUT_PATH
) -> Path:
    rulebook = load_rulebook(rulebook_path)
    output_path.write_text(render_markdown(rulebook))
    return output_path


if __name__ == "__main__":
    path = write_markdown()
    print(f"Wrote {path}")

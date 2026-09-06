"""Assembles the decomposition prompt from the rulebook at runtime (v1.5).

This module holds assembly order and nothing else. Every word the model reads
— the framing, the lead-in, the split/bundle test, the output schema, the
closing, and the rules themselves — comes from the rulebook. The scaffolding
used to live here as string constants; it moved into the rulebook because it
states the decomposition criteria as plainly as the rules do, and the study
depends on none of that being readable from the public repository while rating
is open (ADR-032). The rulebook is held privately until the study closes; see
docs/decomposition_rulebook.README.md.

The practical consequence is unchanged from before: editing a rule, or any of
the scaffolding, changes the assembled prompt with zero code edits here.

open_rulings and changelog are intentionally never rendered into the prompt —
they're provenance/documentation for physicians and the methodology paper, not
instructions to the model. Rendering an open ruling's "current_lean" into the
prompt would functionally decide it by the back door, which the rulebook
explicitly forbids until a physician rules on it.
"""

from clinicalguard.decomposition.rulebook import Rule, Rulebook, load_rulebook


def _render_rule(rule: Rule) -> str:
    example = rule.worked_example
    return (
        f"{rule.prompt_heading}. {rule.statement} {rule.rationale}\n"
        f'  Example: "{example.item}" → {example.decomposition} ({example.why})'
    )


def _render_rules_block(rulebook: Rulebook) -> str:
    ordered = sorted(rulebook.rules, key=lambda r: (r.added_in_version, r.id))
    blocks = [_render_rule(r) for r in ordered]
    return "\n\n".join(blocks)


def _render_constraints_block(rulebook: Rulebook) -> str:
    if not rulebook.constraints:
        return ""
    lines = [f"CONSTRAINT — {c.statement}" for c in rulebook.constraints]
    return "\n\n".join(lines)


def build_decomposition_prompt(item: str, rulebook: Rulebook | None = None) -> tuple[str, int]:
    """Assemble the full decomposition prompt for one rubric item.

    Returns (prompt_text, rulebook_version) — the version travels with every
    call site's result so it can be attached to output without a second
    lookup, per PRD §3 (no DB persistence yet; the version rides in the
    payload/output files instead).
    """
    if rulebook is None:
        rulebook = load_rulebook()

    scaffolding = rulebook.scaffolding
    sections = [
        scaffolding.intro,
        scaffolding.rules_lead_in,
        _render_rules_block(rulebook),
        _render_constraints_block(rulebook),
        scaffolding.test_question,
        scaffolding.output_schema,
        scaffolding.closing.replace("{ITEM}", item),
    ]
    prompt = "\n\n".join(s for s in sections if s)
    return prompt, rulebook.version

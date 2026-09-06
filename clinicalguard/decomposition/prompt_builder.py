"""Assembles the decomposition prompt from the rulebook at runtime (v1.5).

The prompt's fixed scaffolding (task framing, the split/bundle test
question, the output schema) is preserved verbatim from the prompt that
lived hardcoded in decompose_test_v2.py (D21) — it was iterated on
deliberately and isn't rule content. Only the rule statements, rationale,
and worked examples are sourced from the rulebook, so adding, editing, or
removing a rule in docs/decomposition_rulebook.yaml changes the assembled
prompt with zero code edits here.

open_rulings and changelog are intentionally never rendered into the
prompt — they're provenance/documentation for physicians and the
methodology paper, not instructions to the model. Rendering an open
ruling's "current_lean" into the prompt would functionally decide it by
the back door, which the rulebook explicitly forbids until a physician
rules on it.
"""

from clinicalguard.decomposition.rulebook import Rule, Rulebook, load_rulebook

_INTRO = """You are helping decompose clinical rubric items into atomic scoring criteria for a clinical AI evaluation framework.

A rubric item is scored by checking whether an AI's clinical response satisfies it. The problem: some items bundle several separate clinical decisions, so a single yes/no can't fairly score them. Your job is to split bundled items into atomic criteria, each independently checkable as a clean yes/no — BUT ONLY where splitting is clinically valid.

THE GOVERNING PRINCIPLE — split only where the pieces are clinically independent.
Split an item into atoms ONLY when a response could satisfy one atom and miss another WITHOUT the result being clinically misleading. Otherwise KEEP the item bundled as ONE atom."""

# Deliberately rule-count-agnostic (the original hardcoded prompt said "There
# are TWO distinct reasons..." — that count would silently go stale the
# moment a rule is added or removed, which is exactly the drift this PRD
# exists to prevent).
_RULES_LEAD_IN = "Recognize the following patterns when deciding whether an item stays bundled or gets split. You must apply all of them:"

_TEST_QUESTION = """TEST each candidate split: "Could a response satisfy this atom while failing its sibling atom, in a clinically misleading or dangerous way, OR does this split break apart a named/standardized unit?" If YES to either → do not split. If NO → split.

Each resulting atom must be answerable as a single clean yes/no (no "yes but") and must preserve clinical meaning."""

_OUTPUT_SCHEMA = """Return ONLY valid JSON, no preamble, no markdown fences:
{"atoms": [{"text": "<atomic criterion>", "bundle_reason": "<'sequencing' | 'named_unit' | null if this atom is a plain single item>"}]}"""

_CLOSING = """Now decompose this rubric item:

Input rubric item: "{ITEM}"
Output:"""


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

    sections = [
        _INTRO,
        _RULES_LEAD_IN,
        _render_rules_block(rulebook),
        _render_constraints_block(rulebook),
        _TEST_QUESTION,
        _OUTPUT_SCHEMA,
        _CLOSING.replace("{ITEM}", item),
    ]
    prompt = "\n\n".join(s for s in sections if s)
    return prompt, rulebook.version

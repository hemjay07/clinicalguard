"""Loader/validator for the decomposition rulebook (v1.5).

docs/decomposition_rulebook.yaml is the single authoritative source for the
rules used to split bundled rubric items into atomic scoring criteria.
load_rulebook() is the only supported way to read it — a malformed or
missing file must fail loudly here, not silently degrade into a stale or
partial prompt (same principle as safety.engine's SAFETY_CHECK_PARSE_FAILURE:
a component that shapes safety-relevant scoring must never fail quietly).
"""

from pathlib import Path

import yaml
from pydantic import BaseModel, ValidationError

DEFAULT_RULEBOOK_PATH = Path("docs") / "decomposition_rulebook.yaml"


class RulebookError(Exception):
    """The rulebook file is missing, unreadable, or fails schema validation."""


class WorkedExample(BaseModel):
    item: str
    decomposition: str
    why: str


class Rule(BaseModel):
    id: str
    prompt_heading: str
    added_in_version: int
    statement: str
    rationale: str
    worked_example: WorkedExample
    origin: str
    date_added: str


class Constraint(BaseModel):
    id: str
    statement: str


class OpenRuling(BaseModel):
    question: str
    context: str | None = None
    current_lean: str | None = None
    status: str


class ChangelogEntry(BaseModel):
    version: int
    date: str
    change: str
    origin: str
    items_affected: str


class Rulebook(BaseModel):
    version: int
    last_updated: str
    rules: list[Rule]
    constraints: list[Constraint] = []
    open_rulings: list[OpenRuling] = []
    changelog: list[ChangelogEntry] = []


def load_rulebook(path: Path = DEFAULT_RULEBOOK_PATH) -> Rulebook:
    """Read and validate the rulebook. Raises RulebookError on any failure —
    missing file, unparseable YAML, or a document that doesn't match the
    expected schema. There is no fallback path; callers must not catch this
    and substitute a hardcoded prompt."""
    if not path.exists():
        raise RulebookError(
            f"Decomposition rulebook not found at {path}. This is a hard "
            "failure — there is no hardcoded fallback prompt. Restore the "
            "file or point load_rulebook() at the correct path."
        )

    try:
        raw = yaml.safe_load(path.read_text())
    except yaml.YAMLError as e:
        raise RulebookError(f"Decomposition rulebook at {path} is not valid YAML: {e}") from e

    if raw is None:
        raise RulebookError(f"Decomposition rulebook at {path} is empty.")

    try:
        return Rulebook.model_validate(raw)
    except ValidationError as e:
        raise RulebookError(
            f"Decomposition rulebook at {path} does not match the expected schema:\n{e}"
        ) from e

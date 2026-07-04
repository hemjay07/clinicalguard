"""One-time seed: collect free-text safety flags from already-submitted cases
into candidate_safety_rules (PRD v1.3.1 §5).

Cases authored before the collection mechanism deployed (the DKA case) never
had their flags recorded; cases authored after (TB) already have theirs.
Idempotent: a flag is only inserted if no candidate with the same
(eval_case_id, rule_text) exists.

Run: python scripts/seed_candidate_safety_rules.py
"""

import json

from sqlalchemy import text

from clinicalguard.db.session import engine


def main() -> None:
    with engine.begin() as conn:
        rows = conn.execute(text(
            "SELECT id, condition_ids, expected_response FROM eval_cases "
            "WHERE ground_truth_source = 'md_authored_via_ui' AND expected_response IS NOT NULL"
        )).fetchall()

        inserted = skipped = 0
        for case_id, condition_ids, blob in rows:
            data = json.loads(blob)
            flags = data.get("required_safety_flags", {}).get("free_text", [])
            author = (data.get("authored_by") or "").strip() or None
            for flag in flags:
                exists = conn.execute(text(
                    "SELECT 1 FROM candidate_safety_rules "
                    "WHERE eval_case_id = :cid AND rule_text = :txt"
                ), {"cid": case_id, "txt": flag}).fetchone()
                if exists:
                    skipped += 1
                    continue
                conn.execute(text(
                    "INSERT INTO candidate_safety_rules "
                    "(rule_text, eval_case_id, condition_ids, proposed_by, created_at) "
                    "VALUES (:txt, :cid, :conds, :by, NOW())"
                ), {"txt": flag, "cid": case_id, "conds": condition_ids, "by": author})
                inserted += 1

        print(f"Seeded {inserted} candidate rule(s); {skipped} already present.")


if __name__ == "__main__":
    main()

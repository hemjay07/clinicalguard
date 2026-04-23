import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from clinicalguard.db.models import EvalCase
from clinicalguard.db.session import SessionLocal

logger = logging.getLogger(__name__)

CASES_DIR = Path(__file__).parent / "eval_cases" / "nstg_derived"

CASE_FILES = [
    "case_1_severe_malaria.json",
    "case_2_t2dm.json",
    "case_3_hypertension.json",
]
NSTG_CITATIONS = {
    "severe_malaria_adult_altered_consciousness": [
        "Malaria - clinical_features (Severe/Complicated)",
        "Malaria - investigations",
        "Malaria - treatment.drug",
        "Malaria - treatment.adverse_reactions_and_cautions",
        "Malaria - treatment.supportive_measures",
        "Malaria - differential_diagnoses",
    ],
    "newly_diagnosed_t2dm_adult": [
        "Diabetes Mellitus - clinical_features (Type 2)",
        "Diabetes Mellitus - investigations",
        "Diabetes Mellitus - treatment.goals",
        "Diabetes Mellitus - treatment.non_drug",
        "Diabetes Mellitus - treatment.drug",
        "Diabetes Mellitus - treatment.adverse_reactions_and_cautions",
        "Diabetes Mellitus - other_investigations",
    ],
    "newly_diagnosed_hypertension_adult": [
        "Hypertension - introduction",
        "Hypertension - investigations",
        "Hypertension - treatment.goals",
        "Hypertension - treatment.non_drug",
        "Hypertension - treatment.drug",
        "Hypertension - treatment.adverse_reactions_and_cautions",
        "Hypertension - complications",
    ],
}

# Exact condition names as stored in the database.
# Verified against conditions table before writing this mapping.
# If a condition can't be found at seed time, the script raises ValueError
# rather than silently inserting with empty condition_ids.
CONDITION_NAMES = {
    "severe_malaria_adult_altered_consciousness": "Malaria",
    "newly_diagnosed_t2dm_adult": "Diabetes Mellitus",
    "newly_diagnosed_hypertension_adult": "Hypertension",
}


def lookup_condition_id(db: Session, condition_name: str, case_id: str) -> int:
    from clinicalguard.db.models import Condition
    condition = db.query(Condition).filter_by(name=condition_name).first()
    if not condition:
        raise ValueError(
            f"Condition '{condition_name}' not found in database for case '{case_id}'. "
            f"Cannot seed case with empty condition_ids — safety rules would not fire."
        )
    return condition.id


def seed_nstg_cases(db: Session) -> None:
    legacy_updated = (
        db.query(EvalCase)
        .filter(EvalCase.ground_truth_source == "auto_generated_legacy")
        .count()
    )
    if legacy_updated == 0:
        updated = (
            db.query(EvalCase)
            .filter(EvalCase.ground_truth_source != "nstg_derived")
            .all()
        )
        for case in updated:
            case.ground_truth_source = "auto_generated_legacy"
        db.flush()
        logger.info(f"Marked {len(updated)} existing cases as auto_generated_legacy")
    else:
        logger.info(f"{legacy_updated} cases already marked as auto_generated_legacy")

    seeded = 0
    skipped = 0

    for filename in CASE_FILES:
        filepath = CASES_DIR / filename
        if not filepath.exists():
            logger.error(f"Case file not found: {filepath}")
            skipped += 1
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            case_data = json.load(f)

        case_id = case_data["case_id"]

        existing = db.query(EvalCase).filter_by(query=case_data["query"]).first()
        if existing:
            # Update condition_ids if it was seeded with empty list previously
            existing_ids = json.loads(existing.condition_ids) if existing.condition_ids else []
            if not existing_ids:
                condition_name = CONDITION_NAMES[case_id]
                condition_id = lookup_condition_id(db, condition_name, case_id)
                existing.condition_ids = json.dumps([condition_id])
                db.flush()
                logger.info(f"Updated condition_ids for existing case: {case_id}")
            else:
                logger.info(f"Case already exists with condition_ids, skipping: {case_id}")
            skipped += 1
            continue

        condition_name = CONDITION_NAMES[case_id]
        condition_id = lookup_condition_id(db, condition_name, case_id)

        eval_case = EvalCase(
            query=case_data["query"],
            baseline_ground_truth=json.dumps({
                "note": "superseded by expected_response",
                "case_id": case_id
            }),
            condition_ids=json.dumps([condition_id]),
            dataset_version="NSTG 2022",
            source="nstg_derived",
            difficulty="medium",
            is_validated=False,
            ground_truth_source="nstg_derived",
            query_scope=case_data.get("query_scope"),
            expected_response=json.dumps(case_data),
            nstg_citations=json.dumps(NSTG_CITATIONS.get(case_id, [])),
        )
        db.add(eval_case)
        seeded += 1
        logger.info(f"Seeded case: {case_id} with condition_id={condition_id}")

    db.commit()
    logger.info(f"Done. Seeded: {seeded}, Skipped: {skipped}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        seed_nstg_cases(db)
    finally:
        db.close()
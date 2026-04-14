import json
import logging
from sqlalchemy.orm import Session
from clinicalguard.db.models import Condition, EvalCase, GuidelineDataset
from clinicalguard.retrieval.cds_engine import get_cds_response
from clinicalguard.db.session import SessionLocal

logger = logging.getLogger(__name__)

SEED_QUERIES = [
    "child with high fever and neck stiffness",
    "pregnant patient with hypertension",
    "pregnant woman with epilepsy and recurrent seizures",
    "patient with productive cough night sweats and weight loss",
    "child with fever and convulsions",
    "patient with chest pain and shortness of breath",
    "diabetic patient with poor kidney function on metformin",
    "patient with severe malaria and impaired consciousness",
    "pregnant patient with high blood sugar",
    "child with severe anaemia and jaundice",
]


def generate_eval_cases(db: Session) -> None:
    dataset = db.query(GuidelineDataset).filter_by(is_active=True).first()
    if not dataset:
        logger.error("No active dataset found")
        return

    dataset_version = f"{dataset.name} {dataset.version}"
    generated = 0
    skipped = 0

    for query in SEED_QUERIES:
        existing = db.query(EvalCase).filter_by(query=query).first()
        if existing:
            logger.info(f"Skipping existing case: {query}")
            skipped += 1
            continue

        try:
            cds = get_cds_response(query, db)
            condition_ids = [d.condition_id for d in cds.differentials]

            ground_truth = cds.model_dump()

            eval_case = EvalCase(
                query=query,
                baseline_ground_truth=json.dumps(ground_truth, default=str),
                condition_ids=json.dumps(condition_ids),
                dataset_version=dataset_version,
                source="auto_generated",
                difficulty="medium",
                is_validated=False,
            )
            db.add(eval_case)
            db.commit()
            generated += 1
            logger.info(f"Generated case: {query}")

        except Exception as e:
            db.rollback()
            logger.error(f"Failed: {query} — {e}")

    logger.info(f"Done. Generated: {generated}, Skipped: {skipped}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        generate_eval_cases(db)
    finally:
        db.close()
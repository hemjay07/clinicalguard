import logging
from sqlalchemy.orm import Session
from clinicalguard.db.models import Condition, ConditionSafetyRule

logger = logging.getLogger(__name__)

RULES = [
    {
        "condition_name": "Malaria",
        "description": "Mefloquine must not be used in patients with history of cerebral malaria due to increased risk of seizures, encephalopathy, and psychosis.",
        "source": "NSTG 2022, Malaria, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "description": "Oral antidiabetic medications are not indicated for Type 1 diabetes and should not be used during pregnancy or breastfeeding.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.drug",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "description": "Metformin and long-acting sulphonylureas including glibenclamide are contraindicated in patients with poor kidney or liver function.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "description": "Insulin and all sulphonylureas carry significant risk of hypoglycemia. Patients must be counselled and monitored.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "description": "Sodium valproate is contraindicated in pregnant women due to risk of neural tube defects including spina bifida in the foetus.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "description": "Carbamazepine is not recommended in pregnancy due to risk of foetal harm.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.drug",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "description": "Antiepileptic drugs must never be withdrawn abruptly as this can precipitate status epilepticus, a life-threatening emergency.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Hypertension",
        "description": "ACE inhibitors and angiotensin receptor blockers are teratogenic and contraindicated in pregnancy. Safe alternatives include alpha methyldopa, hydralazine, and calcium channel blockers.",
        "source": "NSTG 2022, Hypertension, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Hypertension",
        "description": "Beta blockers must not be used in patients with asthma or heart failure.",
        "source": "NSTG 2022, Hypertension, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
]


def seed_safety_rules(db: Session) -> None:
    seeded = 0
    skipped = 0

    for rule_data in RULES:
        condition = db.query(Condition).filter_by(
            name=rule_data["condition_name"]
        ).first()

        if not condition:
            logger.warning(f"Condition not found: {rule_data['condition_name']}")
            skipped += 1
            continue

        existing = db.query(ConditionSafetyRule).filter_by(
            condition_id=condition.id,
            description=rule_data["description"],
        ).first()

        if existing:
            logger.info(f"Rule already exists, skipping: {rule_data['description'][:60]}")
            skipped += 1
            continue

        rule = ConditionSafetyRule(
            condition_id=condition.id,
            description=rule_data["description"],
            source=rule_data["source"],
            is_verified=rule_data["is_verified"],
            is_universal=False,
            is_active=True,
        )
        db.add(rule)
        seeded += 1

    db.commit()
    logger.info(f"Safety rules seeded: {seeded}, skipped: {skipped}")


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    from clinicalguard.db.session import SessionLocal
    db = SessionLocal()
    try:
        seed_safety_rules(db)
    finally:
        db.close()

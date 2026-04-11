import logging
from sqlalchemy.orm import Session
from clinicalguard.db.models import Condition, ConditionSafetyRule

logger = logging.getLogger(__name__)

RULES = [
    {
        "condition_name": "Malaria",
        "rule_type": "contraindication",
        "description": "Mefloquine must not be used in patients with history of cerebral malaria due to increased risk of seizures, encephalopathy, and psychosis.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Malaria, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "rule_type": "contraindication",
        "description": "Oral antidiabetic medications are not indicated for Type 1 diabetes and should not be used during pregnancy or breastfeeding.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.drug",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "rule_type": "contraindication",
        "description": "Metformin and long-acting sulphonylureas including glibenclamide are contraindicated in patients with poor kidney or liver function.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Diabetes Mellitus",
        "rule_type": "drug_interaction",
        "description": "Insulin and all sulphonylureas carry significant risk of hypoglycemia. Patients must be counselled and monitored.",
        "severity": "WARNING",
        "action": "Surface warning to clinician. Do not block response.",
        "source": "NSTG 2022, Diabetes Mellitus, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "rule_type": "contraindication",
        "description": "Sodium valproate is contraindicated in pregnant women due to risk of neural tube defects including spina bifida in the foetus.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "rule_type": "contraindication",
        "description": "Carbamazepine is not recommended in pregnancy due to risk of foetal harm.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.drug",
        "is_verified": True,
    },
    {
        "condition_name": "Seizures/Epilepsies",
        "rule_type": "dosing",
        "description": "Antiepileptic drugs must never be withdrawn abruptly as this can precipitate status epilepticus, a life-threatening emergency.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Seizures/Epilepsies, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Hypertension",
        "rule_type": "contraindication",
        "description": "ACE inhibitors and angiotensin receptor blockers are teratogenic and contraindicated in pregnancy. Safe alternatives include alpha methyldopa, hydralazine, and calcium channel blockers.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
        "source": "NSTG 2022, Hypertension, treatment.adverse_reactions_and_cautions",
        "is_verified": True,
    },
    {
        "condition_name": "Hypertension",
        "rule_type": "contraindication",
        "description": "Beta blockers must not be used in patients with asthma or heart failure.",
        "severity": "CRITICAL",
        "action": "Flag response and require clinician review before proceeding.",
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
            rule_type=rule_data["rule_type"],
            description=rule_data["description"],
            severity=rule_data["severity"],
            action=rule_data["action"],
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
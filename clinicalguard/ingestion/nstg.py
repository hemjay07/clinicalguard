import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from clinicalguard.db.models import (
    Condition,
    ConditionAdverseReaction,
    ConditionComplication,
    ConditionDifferential,
    ConditionFinding,
    ConditionPrevention,
    ConditionTreatment,
    GuidelineDataset,
)

logger = logging.getLogger(__name__)


def get_or_create_dataset(db: Session) -> GuidelineDataset:
    dataset = (
        db.query(GuidelineDataset)
        .filter_by(name="NSTG", version="2022")
        .first()
    )
    if not dataset:
        dataset = GuidelineDataset(
            name="NSTG",
            version="2022",
            ingestion_version="1.0",
            country="NG",
            care_context="secondary",
            effective_date="2022-01-01",
            source_url="https://huggingface.co/datasets/chisomrutherford/nigeria-clinical-guidelines-dataset",
        )
        db.add(dataset)
        db.flush()
        logger.info("Created NSTG 2022 dataset record")
    return dataset


def delete_condition_children(db: Session, condition_id: int) -> None:
    db.query(ConditionFinding).filter_by(condition_id=condition_id).delete()
    db.query(ConditionTreatment).filter_by(condition_id=condition_id).delete()
    db.query(ConditionComplication).filter_by(condition_id=condition_id).delete()
    db.query(ConditionPrevention).filter_by(condition_id=condition_id).delete()
    db.query(ConditionAdverseReaction).filter_by(condition_id=condition_id).delete()
    db.query(ConditionDifferential).filter_by(condition_id=condition_id).delete()


def ingest_condition(db: Session, data: dict, dataset: GuidelineDataset) -> Condition:
    existing = (
        db.query(Condition)
        .filter_by(dataset_id=dataset.id, name=data["condition_name"])
        .first()
    )

    if existing:
        delete_condition_children(db, existing.id)
        condition = existing
        condition.introduction = data.get("introduction")
        condition.raw_json = json.dumps(data)
        logger.info(f"Updating condition: {data['condition_name']}")
    else:
        condition = Condition(
            dataset_id=dataset.id,
            name=data["condition_name"],
            introduction=data.get("introduction"),
            raw_json=json.dumps(data),
        )
        db.add(condition)
        db.flush()
        logger.info(f"Inserting condition: {data['condition_name']}")

    _ingest_findings(db, condition, data)
    _ingest_treatments(db, condition, data)
    _ingest_complications(db, condition, data)
    _ingest_prevention(db, condition, data)
    _ingest_adverse_reactions(db, condition, data)
    _ingest_differentials(db, condition, data)

    return condition


def _ingest_findings(db: Session, condition: Condition, data: dict) -> None:
    for feature_group in data.get("clinical_features", []):
        subtype_raw = feature_group.get("type", "")
        subtype = None if subtype_raw == "Clinical Features" else subtype_raw

        for feature in feature_group.get("features", []):
            finding = ConditionFinding(
                condition_id=condition.id,
                finding_text=feature,
                finding_type="symptom",
                subtype=subtype,
            )
            db.add(finding)


def _ingest_treatments(db: Session, condition: Condition, data: dict) -> None:
    treatment = data.get("treatment", {})

    for goal in treatment.get("goals", []):
        db.add(ConditionTreatment(
            condition_id=condition.id,
            treatment_type="goal",
            notes=goal,
        ))

    for item in treatment.get("non_drug", []):
        db.add(ConditionTreatment(
            condition_id=condition.id,
            treatment_type="non_drug",
            notes=item,
        ))

    for item in treatment.get("drug", []):
        db.add(ConditionTreatment(
            condition_id=condition.id,
            treatment_type="drug_instruction",
            notes=item,
        ))

    for item in treatment.get("supportive_measures", []):
        db.add(ConditionTreatment(
            condition_id=condition.id,
            treatment_type="supportive",
            notes=item,
        ))


def _ingest_complications(db: Session, condition: Condition, data: dict) -> None:
    for item in data.get("complications", []):
        db.add(ConditionComplication(
            condition_id=condition.id,
            complication=item,
        ))


def _ingest_prevention(db: Session, condition: Condition, data: dict) -> None:
    for item in data.get("prevention", []):
        db.add(ConditionPrevention(
            condition_id=condition.id,
            measure=item,
        ))


def _ingest_adverse_reactions(db: Session, condition: Condition, data: dict) -> None:
    treatment = data.get("treatment", {})
    for item in treatment.get("adverse_reactions_and_cautions", []):
        db.add(ConditionAdverseReaction(
            condition_id=condition.id,
            reaction=item,
        ))


def _ingest_differentials(db: Session, condition: Condition, data: dict) -> None:
    for i, item in enumerate(data.get("differential_diagnoses", [])):
        db.add(ConditionDifferential(
            condition_id=condition.id,
            differential_condition=item,
            priority_order=i + 1,
        ))


def ingest_file(db: Session, filepath: Path) -> Condition:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    dataset = get_or_create_dataset(db)
    condition = ingest_condition(db, data, dataset)
    return condition
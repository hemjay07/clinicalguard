import logging
from datetime import datetime

from sqlalchemy.orm import Session

from clinicalguard.db.models import (
    Condition,
    ConditionAdverseReaction,
    ConditionComplication,
    ConditionInvestigation,
    ConditionPrevention,
    ConditionSafetyRule,
    ConditionTreatment,
    GuidelineDataset,
)
from clinicalguard.models.cds import (
    CDSResponse,
    Citation,
    DifferentialResult,
    SafetyFlag,
    TreatmentDetail,
)
from clinicalguard.retrieval.hybrid import RetrievalResult, hybrid_search

logger = logging.getLogger(__name__)


def build_citation(condition: Condition, dataset: GuidelineDataset) -> Citation:
    # Every differential result carries a citation back to the source guideline.
    # This is a first-class requirement: any recommendation surfaced by the
    # system must be traceable to the specific guideline it came from.
    return Citation(
        source=f"{dataset.name} {dataset.version}",
        country=dataset.country,
        condition_slug=condition.name.lower().replace(" ", "-"),
    )


def build_treatment(condition: Condition, db: Session) -> TreatmentDetail:
    treatments = db.query(ConditionTreatment).filter_by(condition_id=condition.id).all()

    # Treatment types are stored as separate records with a treatment_type
    # discriminator rather than in separate tables. This keeps the schema
    # flat while preserving the semantic distinctions between goals, non-drug
    # measures, drug instructions, and supportive measures.
    goals = [t.notes for t in treatments if t.treatment_type == "goal" and t.notes]
    non_drug = [t.notes for t in treatments if t.treatment_type == "non_drug" and t.notes]
    drug_instructions = [t.notes for t in treatments if t.treatment_type == "drug_instruction" and t.notes]
    adverse_reactions = [t.notes for t in treatments if t.treatment_type == "supportive" and t.notes]

    return TreatmentDetail(
        goals=goals,
        non_drug=non_drug,
        drug_instructions=drug_instructions,
        adverse_reactions=adverse_reactions,
    )


def build_differential(
    result: RetrievalResult,
    db: Session,
) -> DifferentialResult:
    condition = db.query(Condition).filter_by(id=result.condition_id).first()
    dataset = db.query(GuidelineDataset).filter_by(id=condition.dataset_id).first()

    investigations = [
        i.investigation_text
        for i in db.query(ConditionInvestigation)
        .filter_by(condition_id=condition.id)
        .all()
    ]

    complications = [
        c.complication
        for c in db.query(ConditionComplication)
        .filter_by(condition_id=condition.id)
        .all()
    ]

    prevention = [
        p.measure
        for p in db.query(ConditionPrevention)
        .filter_by(condition_id=condition.id)
        .all()
    ]

    # Safety flags in CDS mode are proactive, not reactive.
    # They surface all verified rules for the retrieved condition so a
    # clinician sees relevant safety considerations before making a decision.
    # This differs from eval mode where flags fire in response to something
    # an AI response actually recommended. See safety/engine.py for eval mode.
    safety_flags = [
        SafetyFlag(
            rule_type=rule.rule_type,
            description=rule.description,
            severity=rule.severity,
            verified=rule.is_verified,
        )
        for rule in db.query(ConditionSafetyRule)
        .filter_by(
            condition_id=condition.id,
            is_active=True,
            is_verified=True,
        )
        .all()
    ]

    return DifferentialResult(
        condition_name=condition.name,
        condition_id=condition.id,
        relevance_score=result.score,
        citation=build_citation(condition, dataset),
        investigations=investigations,
        treatment=build_treatment(condition, db),
        complications=complications,
        prevention=prevention,
        safety_flags=safety_flags,
    )


def get_cds_response(
    query: str,
    db: Session,
    top_k: int = 5,
    use_hyde: bool = False,
) -> CDSResponse:
    # The CDS response serves two purposes:
    # 1. In CDS mode: returns guideline-backed recommendations to a clinician.
    # 2. In eval mode: provides the ground truth that AI responses are scored
    #    against. When generating eval cases, the CDS response is stored as
    #    the baseline ground truth JSON. See retrieval/generate_eval_cases.py.
    logger.info(f"CDS query: '{query}'")

    retrieval_results = hybrid_search(query, db, top_k=top_k, use_hyde=use_hyde)

    dataset = db.query(GuidelineDataset).filter_by(is_active=True).first()
    guideline_version = f"{dataset.name} {dataset.version}" if dataset else "Unknown"

    differentials = [
        build_differential(result, db)
        for result in retrieval_results
    ]

    total_flags = sum(len(d.safety_flags) for d in differentials)

    return CDSResponse(
        query=query,
        retrieved_at=datetime.utcnow(),
        differentials=differentials,
        safety_rules_fired=total_flags,
        guideline_version=guideline_version,
    )
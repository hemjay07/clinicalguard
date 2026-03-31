import logging

from enum import Enum
from openai import OpenAI
from sqlalchemy.orm import Session

from clinicalguard.config import settings
from clinicalguard.db.models import Condition, ConditionEmbedding, ConditionFinding

logger = logging.getLogger(__name__)
client = OpenAI(api_key=str(settings.openai_api_key))

EMBEDDING_MODEL = "text-embedding-3-small"


class EmbeddingStrategy(Enum):
    FINDINGS_FOCUSED = "findings_focused"
    COMPREHENSIVE = "comprehensive"


def build_embedding_text(
    condition: Condition,
    db: Session,
    strategy: EmbeddingStrategy = EmbeddingStrategy.COMPREHENSIVE,
) -> str:
    parts = [condition.name]

    if condition.introduction:
        parts.append(condition.introduction)

    findings = db.query(ConditionFinding).filter_by(condition_id=condition.id).all()
    if findings:
        parts.append("Clinical findings: " + ". ".join(f.finding_text for f in findings))

    if strategy == EmbeddingStrategy.COMPREHENSIVE:
        from clinicalguard.db.models import ConditionComplication, ConditionAdverseReaction

        complications = db.query(ConditionComplication).filter_by(condition_id=condition.id).all()
        if complications:
            parts.append("Complications: " + ". ".join(c.complication for c in complications))

        reactions = db.query(ConditionAdverseReaction).filter_by(condition_id=condition.id).all()
        if reactions:
            parts.append("Adverse reactions: " + ". ".join(r.reaction for r in reactions))

    return "\n\n".join(parts)


def embed_condition(condition: Condition, 
                    db: Session,
                    strategy: EmbeddingStrategy = EmbeddingStrategy.COMPREHENSIVE,
) -> ConditionEmbedding:
    existing = (
        db.query(ConditionEmbedding)
        .filter_by(condition_id=condition.id, model_name=EMBEDDING_MODEL)
        .first()
    )

    embedding_text = build_embedding_text(condition, db, strategy)
    response = client.embeddings.create(
        input=embedding_text,
        model=EMBEDDING_MODEL,
    )
    vector = response.data[0].embedding

    if existing:
        existing.embedding_text = embedding_text
        existing.embedding = vector
        logger.info(f"Updated embedding: {condition.name}")
        return existing
    else:
        embedding = ConditionEmbedding(
            condition_id=condition.id,
            embedding_text=embedding_text,
            model_name=EMBEDDING_MODEL,
            embedding=vector,
        )
        db.add(embedding)
        logger.info(f"Created embedding: {condition.name}")
        return embedding


def embed_all_conditions(db: Session) -> None:
    conditions = db.query(Condition).all()
    logger.info(f"Embedding {len(conditions)} conditions")

    for condition in conditions:
        try:
            embed_condition(condition, db)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed: {condition.name} — {e}")

    logger.info("Embedding complete")
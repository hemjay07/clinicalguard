import uuid
from datetime import datetime
from pgvector.sqlalchemy import Vector

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from clinicalguard.db.session import Base


class GuidelineDataset(Base):
    __tablename__ = "guideline_datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    ingestion_version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0")
    country: Mapped[str] = mapped_column(String(10), nullable=False)
    care_context: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    effective_date: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    conditions: Mapped[list["Condition"]] = relationship(
        "Condition", back_populates="dataset"
    )

    __table_args__ = (UniqueConstraint("name", "version"),)


class Condition(Base):
    __tablename__ = "conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("guideline_datasets.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icd10_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    icd11_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    coding_system: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ICD-10"
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_emergency: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    introduction: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    dataset: Mapped["GuidelineDataset"] = relationship(
        "GuidelineDataset", back_populates="conditions"
    )
    synonyms: Mapped[list["ConditionSynonym"]] = relationship(
        "ConditionSynonym", back_populates="condition"
    )
    findings: Mapped[list["ConditionFinding"]] = relationship(
        "ConditionFinding", back_populates="condition"
    )
    severity_tiers: Mapped[list["ConditionSeverityTier"]] = relationship(
        "ConditionSeverityTier", back_populates="condition"
    )
    treatments: Mapped[list["ConditionTreatment"]] = relationship(
        "ConditionTreatment", back_populates="condition"
    )
    differentials: Mapped[list["ConditionDifferential"]] = relationship(
        "ConditionDifferential", back_populates="condition"
    )
    safety_rules: Mapped[list["ConditionSafetyRule"]] = relationship(
        "ConditionSafetyRule", back_populates="condition"
    )
    embeddings: Mapped[list["ConditionEmbedding"]] = relationship(
        "ConditionEmbedding", back_populates="condition"
    )
    complications: Mapped[list["ConditionComplication"]] = relationship(
        "ConditionComplication", back_populates="condition"
    )
    prevention_measures: Mapped[list["ConditionPrevention"]] = relationship(
        "ConditionPrevention", back_populates="condition"
    )
    adverse_reactions: Mapped[list["ConditionAdverseReaction"]] = relationship(
        "ConditionAdverseReaction", back_populates="condition"
    )
    investigations: Mapped[list["ConditionInvestigation"]] = relationship(
    "ConditionInvestigation", back_populates="condition"
)
    __table_args__ = (UniqueConstraint("dataset_id", "icd10_code"),)


class ConditionSynonym(Base):
    __tablename__ = "condition_synonyms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    synonym: Mapped[str] = mapped_column(String(200), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    is_preferred: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="synonyms"
    )


class ConditionFinding(Base):
    __tablename__ = "condition_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    finding_text: Mapped[str] = mapped_column(Text, nullable=False)
    finding_type: Mapped[str] = mapped_column(String(50), nullable=False)
    subtype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="findings"
    )


class ConditionSeverityTier(Base):
    __tablename__ = "condition_severity_tiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    tier_label: Mapped[str] = mapped_column(String(50), nullable=False)
    tier_code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_required: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="severity_tiers"
    )


class ConditionTreatment(Base):
    __tablename__ = "condition_treatments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    subtype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    care_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    treatment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    drug_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dose: Mapped[str | None] = mapped_column(String(200), nullable=True)
    route: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(100), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    age_restriction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    weight_based: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    guideline_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="treatments"
    )


class ConditionDifferential(Base):
    __tablename__ = "condition_differentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    differential_condition: Mapped[str] = mapped_column(Text, nullable=False)
    distinguishing_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority_order: Mapped[int | None] = mapped_column(Integer, nullable=True)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="differentials"
    )


class ConditionSafetyRule(Base):
    __tablename__ = "condition_safety_rules"

    # rule_type, severity, and action were removed (see safety/engine.py
    # comment): they carried no methodological signal in the current design.
    # Any future reintroduction should be a deliberate, classified decision.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_universal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rule_logic: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    condition: Mapped["Condition | None"] = relationship(
        "Condition", back_populates="safety_rules"
    )


class ConditionEmbedding(Base):
    __tablename__ = "condition_embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    embedding_text: Mapped[str] = mapped_column(Text, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    embedding: Mapped[list] = mapped_column(Vector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="embeddings"
    )

    __table_args__ = (UniqueConstraint("condition_id", "model_name"),)



class ConditionComplication(Base):
    __tablename__ = "condition_complications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    complication: Mapped[str] = mapped_column(Text, nullable=False)
    subtype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="complications"
    )


class ConditionPrevention(Base):
    __tablename__ = "condition_prevention"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    measure: Mapped[str] = mapped_column(Text, nullable=False)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="prevention_measures"
    )


class ConditionAdverseReaction(Base):
    __tablename__ = "condition_adverse_reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    reaction: Mapped[str] = mapped_column(Text, nullable=False)
    subtype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="adverse_reactions"
    )


class ConditionInvestigation(Base):
    __tablename__ = "condition_investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=False
    )
    investigation_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    condition: Mapped["Condition"] = relationship(
        "Condition", back_populates="investigations"
    )


class User(Base):
    """An app user keyed to a verified Supabase Auth identity (ADR-031).
    Rows are created/linked on first sign-in (see api.deps.get_current_user);
    there are no local credentials. Not a permissions system — the only
    access distinction is owner-vs-rater, decided by email against
    settings.owner_email."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Nullable: a legacy pre-Supabase row keeps existing (preserving its
    # eval_cases FKs) until its author signs in and gets linked by email.
    supabase_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, unique=True, index=True
    )
    email: Mapped[str | None] = mapped_column(
        String(320), nullable=True, unique=True, index=True
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )


class DecompositionResponse(Base):
    """One rater's judgment on one of the 15 fixed decomposition items
    (ADR-032). The items themselves are frozen seed content in
    clinicalguard.decomposition_items — identical for every rater, never
    authored through the UI. One row per rater x item; editing updates the
    row in place (edit-own pattern)."""

    __tablename__ = "decomposition_response"
    __table_args__ = (
        UniqueConstraint("rater_user_id", "item_id", name="uq_decomposition_rater_item"),
        CheckConstraint("decision IN ('keep_whole', 'split')", name="ck_decomposition_decision"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rater_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    # Only meaningful when decision == 'split'.
    split_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # JSON array of brief rater-written piece labels, ordered, one per piece
    # (the carve, not just the count). Required alongside split_count.
    split_labels: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.utcnow
    )


class EvalCase(Base):
    __tablename__ = "eval_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    baseline_ground_truth: Mapped[str] = mapped_column(Text, nullable=False)
    contextual_ground_truth: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition_ids: Mapped[str] = mapped_column(Text, nullable=False)
    dataset_version: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="auto_generated")
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    organisation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    nstg_citations: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    ground_truth_source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="auto_generated_legacy"
    )
    query_scope_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    # True only when the author actively ticked "no danger-level constraints
    # apply" (ADR-029). False covers both "not yet answered" (legacy rows,
    # pre-v1.4) and "answered with constraints" — those are distinguished by
    # whether required_safety_flags.free_text is non-empty in expected_response.
    safety_none_declared: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Nullable: rows predating auth (v1.3.1 and earlier) have no session-backed
    # author. A legacy case must go through the one-time backfill (matching
    # its free-text authored_by against a seeded user) before it's editable —
    # NULL is never silently treated as "editable by anyone" (see the
    # ownership check in the PUT endpoint).
    author_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.utcnow
    )


class CandidateSafetyRule(Base):
    """Free-text safety flags authored by MDs, collected as candidates for the
    verified rule library. Background collection only for now — the review UI
    that consumes this table is Phase D (ADR-027)."""

    __tablename__ = "candidate_safety_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    eval_case_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("eval_cases.id"), nullable=True
    )
    # JSON array of condition ids — the condition context the flag was raised in.
    condition_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("conditions.id"), nullable=True
    )
    dataset_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("guideline_datasets.id"), nullable=True
    )
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
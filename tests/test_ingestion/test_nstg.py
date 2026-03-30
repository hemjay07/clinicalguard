# NOTE: These tests run against the real Supabase database configured in .env.
# Each test uses a session that is rolled back after completion, so no data persists.
# The correct long-term solution is a separate test database (TEST_DATABASE_URL).
# This is a known limitation documented in ADR-008.

import json
from pathlib import Path

import pytest

from clinicalguard.db.models import Condition, ConditionFinding
from clinicalguard.db.session import Base, SessionLocal, engine
from clinicalguard.ingestion.nstg import ingest_file


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


ABORTION_FILE = Path("data/raw/nstg/processed_json/ABORTION.json")


def test_condition_is_created(db):
    condition = ingest_file(db, ABORTION_FILE)
    db.commit()

    result = db.query(Condition).filter_by(name="Abortion").first()
    assert result is not None
    assert result.raw_json is not None
    assert json.loads(result.raw_json)["condition_name"] == "Abortion"


def test_findings_count(db):
    condition = ingest_file(db, ABORTION_FILE)
    db.commit()

    count = db.query(ConditionFinding).filter_by(condition_id=condition.id).count()
    assert count == 13


def test_upsert_does_not_duplicate(db):
    ingest_file(db, ABORTION_FILE)
    db.commit()
    ingest_file(db, ABORTION_FILE)
    db.commit()

    count = db.query(Condition).filter_by(name="Abortion").count()
    assert count == 1
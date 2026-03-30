from clinicalguard.db.session import engine, Base, SessionLocal
from clinicalguard.db.models import Condition, ConditionFinding, ConditionTreatment
from clinicalguard.ingestion.nstg import ingest_file
import pytest


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()

def test_all_conditions_exist(db):
    assert db.query(Condition).count() == 251

def test_all_conditions_have_raw_json(db):
    assert db.query(Condition).filter(Condition.raw_json == None).count() == 0

def test_all_conditions_have_a_name(db):
    assert db.query(Condition).filter(Condition.name == "").count()==0

def test_at_least_one_finding_in_dataset(db):
    assert db.query(ConditionFinding).count() >= 2400

def test_at_least_one_treatment_in_dataset(db):
    assert db.query(ConditionTreatment).count() >= 2500
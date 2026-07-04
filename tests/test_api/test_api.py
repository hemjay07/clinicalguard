"""
Integration tests for the ClinicalGuard API.

Per ADR-008 the tests run against the real database. To keep them from
persisting anything (the POST endpoint commits), each test runs inside an
outer transaction with a SAVEPOINT that survives the endpoint's own
`db.commit()`; the outer transaction is rolled back at teardown. The expensive
LLM annotation in `source_organizer.organize_source` is monkeypatched so the
source-material endpoint test does not make a real model call.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_db
from clinicalguard.api.main import app
from clinicalguard.db.session import engine

MALARIA_ID = 149
MALARIA_SUBTYPE = "Severe (Complicated) malaria"


@pytest.fixture
def db_session():
    """A session joined to an outer transaction. App-code `commit()` only
    commits an inner SAVEPOINT, which the outer rollback discards — so test
    writes never reach the real database."""
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    yield session

    session.close()
    trans.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def valid_payload(**overrides):
    payload = {
        "conditions": [{"condition_id": MALARIA_ID, "subtype": MALARIA_SUBTYPE}],
        "authored_by": "Dr Test",
        "query": "Adult with high fever, altered consciousness, recent travel to endemic area — diagnosis and management",
        "what_this_evaluates": "Recognition of severe malaria features.",
        "query_scope": "diagnosis + acute management",
        "provenance_notes": "Fully NSTG-grounded; severity thresholds from clinical judgment.",
        "diagnoses": {
            "primary": "Severe (complicated) malaria",
            "critical_differentials": ["Meningitis"],
            "other_considerations": ["Septicaemia"],
        },
        "investigations": {
            "required": ["Blood smear for malaria parasites", "Blood glucose"],
            "expected": ["Packed cell volume"],
            "situational": [{"item": "CSF analysis", "trigger": "AI raises meningitis as a differential"}],
        },
        "treatments": {
            "required": ["Parenteral artesunate"],
            "expected": ["Supportive care"],
            "situational": [],
        },
        "complications": ["Cerebral malaria"],
        "monitoring": {
            "required_elements": ["Level of consciousness", "Blood glucose"],
            "expected_elements": ["Temperature"],
        },
        "escalation": ["Deep coma — escalate to ICU", "Anuria — renal review"],
        "safety": {"selected_rule_ids": [], "free_text": ["Mefloquine cautions"]},
        "reasoning_archetypes": ["severity_stratification", "critical_red_flag_recognition"],
        "other_archetypes": ["a custom reasoning pattern"],
    }
    payload.update(overrides)
    return payload


# --- meta ---------------------------------------------------------------------

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["api_base"] == "/api/v1"


# --- conditions ---------------------------------------------------------------

def test_list_conditions(client):
    r = client.get("/api/v1/conditions")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 251
    first = data[0]
    assert {"id", "name", "counts"} <= first.keys()
    assert {"findings", "treatments", "safety_rules"} <= first["counts"].keys()


def test_subtypes(client):
    r = client.get(f"/api/v1/conditions/{MALARIA_ID}/subtypes")
    assert r.status_code == 200
    assert MALARIA_SUBTYPE in r.json()


def test_subtypes_unknown_condition_404(client):
    r = client.get("/api/v1/conditions/999999/subtypes")
    assert r.status_code == 404


def test_condition_details(client):
    r = client.get(f"/api/v1/conditions/{MALARIA_ID}/details")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Malaria"
    assert data["counts"]["findings"] > 0
    assert isinstance(data["safety_rules"], list)


def test_condition_details_404(client):
    r = client.get("/api/v1/conditions/999999/details")
    assert r.status_code == 404


def test_source_material(client):
    """Deterministic structured source material (no LLM) for authoring."""
    r = client.get(
        f"/api/v1/conditions/{MALARIA_ID}/source-material",
        params={"subtype": MALARIA_SUBTYPE},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["condition"]["name"] == "Malaria"
    assert data["scoped_to_subtype"] == MALARIA_SUBTYPE
    # Subtype scopes findings; the full pool of other categories is still present.
    assert "by_subtype" in data["findings"]
    assert "items" in data["investigations_pool"]
    assert "by_type" in data["treatments_pool"]
    assert data["extraction_metadata"]["llm_involved"] is False


def test_source_material_unknown_condition_404(client):
    r = client.get("/api/v1/conditions/999999/source-material")
    assert r.status_code == 404


# --- safety rules -------------------------------------------------------------

def test_safety_rules(client):
    r = client.get("/api/v1/safety-rules")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    rule = data[0]
    assert {"id", "condition_name", "severity", "description", "is_verified"} <= rule.keys()


# --- eval cases ---------------------------------------------------------------

def test_create_eval_case_success(client):
    r = client.post("/api/v1/eval-cases", json=valid_payload())
    assert r.status_code == 201, r.text
    data = r.json()
    assert isinstance(data["id"], int)
    assert data["case_id"]
    assert isinstance(data["warnings"], list)


def test_create_then_list_and_get(client):
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()
    case_id = created["id"]

    listed = client.get("/api/v1/eval-cases")
    assert listed.status_code == 200
    # The list surfaces only the MD-authored corpus.
    assert all(c["ground_truth_source"] == "md_authored_via_ui" for c in listed.json())
    listed_case = next(c for c in listed.json() if c["id"] == case_id)
    assert "Malaria" in listed_case["condition_names"]

    one = client.get(f"/api/v1/eval-cases/{case_id}")
    assert one.status_code == 200
    body = one.json()
    assert body["ground_truth_source"] == "md_authored_via_ui"
    assert [c["name"] for c in body["conditions"]] == ["Malaria"]
    exp = body["expected_response"]
    assert exp["expected_diagnoses"]["required"]["primary"] == "Severe (complicated) malaria"
    # situational item mapped to the stored {test, trigger} shape
    sit = exp["required_investigations"]["situational"]
    assert sit and sit[0]["test"] == "CSF analysis" and sit[0]["trigger"]
    # reasoning archetypes stored; monitoring principle no longer present
    assert exp["reasoning_archetypes"] == ["severity_stratification", "critical_red_flag_recognition"]
    assert exp["other_archetypes"] == ["a custom reasoning pattern"]
    assert "required_principle" not in exp["required_monitoring"]
    # provenance notes stored in the blob (ADR-026)
    assert exp["provenance_notes"] == "Fully NSTG-grounded; severity thresholds from clinical judgment."
    # escalation is flat (ADR-028)
    assert exp["escalation_triggers"] == ["Deep coma — escalate to ICU", "Anuria — renal review"]
    assert "required_escalation_triggers" not in exp


def test_create_collects_candidate_safety_rules(client, db_session):
    """Free-text safety flags are also collected into candidate_safety_rules
    (ADR-027) with the case, condition context, and author recorded."""
    from clinicalguard.db.models import CandidateSafetyRule

    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()
    rows = (
        db_session.query(CandidateSafetyRule)
        .filter(CandidateSafetyRule.eval_case_id == created["id"])
        .all()
    )
    assert [r.rule_text for r in rows] == ["Mefloquine cautions"]
    assert rows[0].proposed_by == "Dr Test"
    import json as _json
    assert _json.loads(rows[0].condition_ids) == [MALARIA_ID]


def test_create_multi_condition(client):
    """A case can reference more than one condition (condition_ids JSON array)."""
    payload = valid_payload(conditions=[
        {"condition_id": MALARIA_ID, "subtype": MALARIA_SUBTYPE},
        {"condition_id": 1, "subtype": None},  # Abortion (id 1) — second condition
    ])
    created = client.post("/api/v1/eval-cases", json=payload)
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]

    body = client.get(f"/api/v1/eval-cases/{case_id}").json()
    assert body["condition_ids"] == [MALARIA_ID, 1]
    names = [c["name"] for c in body["conditions"]]
    assert "Malaria" in names and "Abortion" in names
    # derived_from reflects both sources
    assert len(body["expected_response"]["derived_from"]) == 2


def test_create_partially_unknown_conditions_404(client):
    payload = valid_payload(conditions=[
        {"condition_id": MALARIA_ID, "subtype": None},
        {"condition_id": 999999, "subtype": None},
    ])
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 404


def test_create_empty_fields_still_submits(client):
    """v1.3.1 §4: no field is required at submission. Empty diagnosis, empty
    safety layer, no required investigations/treatments — all valid states."""
    payload = valid_payload(
        diagnoses={"primary": "", "critical_differentials": [], "other_considerations": []},
        investigations={"required": [], "expected": [], "situational": []},
        treatments={"required": [], "expected": [], "situational": []},
        safety={"selected_rule_ids": [], "free_text": []},
        escalation=[],
    )
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 201, r.text
    # thinness surfaces as warnings, never as blocks — and never for safety
    warnings = r.json()["warnings"]
    assert not any("safety" in w.lower() for w in warnings)


def test_create_situational_missing_trigger_warns_not_blocks(client):
    payload = valid_payload(
        investigations={
            "required": ["Blood smear"],
            "expected": [],
            "situational": [{"item": "CSF analysis", "trigger": ""}],
        }
    )
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 201, r.text
    assert any("trigger" in w.lower() for w in r.json()["warnings"])


def test_create_unknown_condition_404(client):
    r = client.post("/api/v1/eval-cases", json=valid_payload(conditions=[{"condition_id": 999999}]))
    assert r.status_code == 404


def test_get_eval_case_404(client):
    r = client.get("/api/v1/eval-cases/999999999")
    assert r.status_code == 404

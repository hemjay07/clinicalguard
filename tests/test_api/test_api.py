"""
Integration tests for the ClinicalGuard API.

Per ADR-008 the tests run against the real database. To keep them from
persisting anything (the POST endpoint commits), each test runs inside an
outer transaction with a SAVEPOINT that survives the endpoint's own
`db.commit()`; the outer transaction is rolled back at teardown. The expensive
LLM annotation in `source_organizer.organize_source` is monkeypatched so the
source-material endpoint test does not make a real model call.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db
from clinicalguard.api.main import app
from clinicalguard.config import settings
from clinicalguard.db.models import User
from clinicalguard.db.session import engine

MALARIA_ID = 149
MALARIA_SUBTYPE = "Severe (Complicated) malaria"
TEST_AUTHOR_NAME = "Dr Test"


def make_user(db_session, email: str, display_name: str) -> User:
    """A Supabase-linked user row (ADR-031), created inside the same
    rolled-back transaction as everything else in the test."""
    user = User(email=email, supabase_user_id=uuid.uuid4(), display_name=display_name)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


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
def test_user(db_session):
    return make_user(db_session, "drtest@example.com", TEST_AUTHOR_NAME)


@pytest.fixture
def client(db_session, test_user):
    """Authenticated client — most endpoints under test require a session.
    Unauthenticated behavior is covered separately (test_create_requires_auth)."""
    def _override_get_db():
        yield db_session

    def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def unauthenticated_client(db_session):
    """Same DB session, no auth override — for testing the 401 path."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def valid_payload(**overrides):
    payload = {
        "conditions": [{"condition_id": MALARIA_ID, "subtype": MALARIA_SUBTYPE}],
        "query": "Adult with high fever, altered consciousness, recent travel to endemic area — diagnosis and management",
        "what_this_evaluates": "Recognition of severe malaria features.",
        "query_scope": "diagnosis + acute management",
        "provenance_notes": "Fully NSTG-grounded; severity thresholds from clinical judgment.",
        "guideline_provenance": "nstg_plus_other",
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
        "safety": {"free_text": ["Mefloquine cautions"], "none_declared": False},
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
    assert {"id", "condition_name", "description", "is_verified"} <= rule.keys()


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
    # provenance notes stored in the blob (ADR-026), provenance tier alongside
    # it (ADR-033) — both descriptive metadata the scorer never reads.
    assert exp["provenance_notes"] == "Fully NSTG-grounded; severity thresholds from clinical judgment."
    assert exp["guideline_provenance"] == "nstg_plus_other"
    assert body["guideline_provenance"] == "nstg_plus_other"
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
    assert rows[0].proposed_by == TEST_AUTHOR_NAME
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
    """v1.3.1 §4: no field is required at submission except safety (ADR-029,
    the one deliberate exception — see test_create_safety_unanswered_422).
    Empty diagnosis, no required investigations/treatments — all valid states
    as long as safety is actively resolved (here, declared empty)."""
    payload = valid_payload(
        diagnoses={"primary": "", "critical_differentials": [], "other_considerations": []},
        investigations={"required": [], "expected": [], "situational": []},
        treatments={"required": [], "expected": [], "situational": []},
        safety={"free_text": [], "none_declared": True},
        escalation=[],
        guideline_provenance="nstg_only",
        provenance_notes="",
    )
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 201, r.text
    warnings = r.json()["warnings"]
    assert not any("safety" in w.lower() for w in warnings)


def test_create_safety_unanswered_422(client):
    """ADR-029: submission is blocked unless the author either lists a harm
    constraint or ticks the declared-empty checkbox — both empty is invalid."""
    payload = valid_payload(safety={"free_text": [], "none_declared": False})
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 422
    assert "safety question" in r.json()["detail"]["errors"][0].lower()


def test_create_safety_both_filled_422(client):
    """Ticking declared-empty while also listing constraints is not a valid
    submit state either — exactly one of the two must hold."""
    payload = valid_payload(safety={"free_text": ["Mefloquine cautions"], "none_declared": True})
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 422
    assert "safety question" in r.json()["detail"]["errors"][0].lower()


def test_create_without_provenance_tier_422(client):
    """ADR-033: the provenance tier is the second required answer. Without it
    a reviewer has no idea what to check the answer against."""
    payload = valid_payload(guideline_provenance=None)
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 422
    assert "where this answer came from" in r.json()["detail"]["errors"][0].lower()


@pytest.mark.parametrize("tier", ["nstg_plus_other", "judgment_primary"])
def test_create_mixed_provenance_requires_notes_422(client, tier):
    """The two mixed tiers assert something came from outside NSTG — which
    is unverifiable unless the author says which parts, and from where."""
    payload = valid_payload(guideline_provenance=tier, provenance_notes="   ")
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 422
    assert "which parts came from where" in r.json()["detail"]["errors"][0].lower()


def test_create_nstg_only_needs_no_notes(client):
    """The whole point of the tier: when NSTG covers all of it, there is
    nothing to attribute, so the notes stay empty and submission passes."""
    payload = valid_payload(guideline_provenance="nstg_only", provenance_notes="")
    r = client.post("/api/v1/eval-cases", json=payload)
    assert r.status_code == 201, r.text
    body = client.get(f"/api/v1/eval-cases/{r.json()['id']}").json()
    assert body["guideline_provenance"] == "nstg_only"
    assert body["expected_response"]["guideline_provenance"] == "nstg_only"


def test_update_enforces_provenance_too(client):
    """Save-of-edit runs the same gate as submit, so an existing case with a
    null tier can be saved only once its author picks one."""
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()
    r = client.put(
        f"/api/v1/eval-cases/{created['id']}",
        json=valid_payload(guideline_provenance=None),
    )
    assert r.status_code == 422

    r = client.put(
        f"/api/v1/eval-cases/{created['id']}",
        json=valid_payload(guideline_provenance="judgment_primary", provenance_notes="Mostly WHO guidance."),
    )
    assert r.status_code == 200, r.text
    body = client.get(f"/api/v1/eval-cases/{created['id']}").json()
    assert body["guideline_provenance"] == "judgment_primary"


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


# --- auth (ADR-031) ------------------------------------------------------------

def test_create_requires_auth(unauthenticated_client):
    r = unauthenticated_client.post("/api/v1/eval-cases", json=valid_payload())
    assert r.status_code == 401


def test_me(client, test_user):
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "drtest@example.com"
    assert body["display_name"] == TEST_AUTHOR_NAME
    assert body["is_owner"] is False


def test_me_without_token_401(unauthenticated_client):
    r = unauthenticated_client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_garbage_token_401(unauthenticated_client):
    r = unauthenticated_client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert r.status_code == 401


def test_created_case_stamped_with_author_user_id(client, test_user):
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()
    body = client.get(f"/api/v1/eval-cases/{created['id']}").json()
    assert body["author_user_id"] == test_user.id
    assert body["expected_response"]["authored_by"] == TEST_AUTHOR_NAME


# --- case editing (ADR-030) ------------------------------------------------

def test_update_own_case_succeeds(client):
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()

    r = client.put(f"/api/v1/eval-cases/{created['id']}", json=valid_payload(query="Updated query text."))
    assert r.status_code == 200, r.text
    assert r.json()["id"] == created["id"]

    body = client.get(f"/api/v1/eval-cases/{created['id']}").json()
    assert body["query"] == "Updated query text."
    assert body["updated_at"] is not None


def test_update_other_users_case_403(client, db_session, test_user):
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()

    other = make_user(db_session, "other@example.com", "Other Doctor")

    app.dependency_overrides[get_current_user] = lambda: other
    r = client.put(f"/api/v1/eval-cases/{created['id']}", json=valid_payload())
    app.dependency_overrides[get_current_user] = lambda: test_user
    assert r.status_code == 403


def test_update_requires_auth(client):
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()
    # Both fixtures share the same global `app` (dependency_overrides is
    # process-wide), so drop the auth override in place rather than mixing
    # in a second client fixture — that ordering is undefined and flaky.
    app.dependency_overrides.pop(get_current_user, None)
    r = client.put(f"/api/v1/eval-cases/{created['id']}", json=valid_payload())
    assert r.status_code == 401


def test_update_unknown_case_404(client):
    r = client.put("/api/v1/eval-cases/999999999", json=valid_payload())
    assert r.status_code == 404


# --- result privacy (A3 / ADR-031) -----------------------------------------

def test_list_shows_only_own_cases(client, db_session, test_user, monkeypatch):
    # The real owner_email already exists as a users row in the shared DB
    # (unique index) — point the owner check at a test identity instead.
    monkeypatch.setattr(settings, "owner_email", "owner-test@example.com")
    created = client.post("/api/v1/eval-cases", json=valid_payload()).json()

    other = make_user(db_session, "other-rater@example.com", "Other Doctor")
    app.dependency_overrides[get_current_user] = lambda: other
    listed_as_other = client.get("/api/v1/eval-cases").json()
    viewed_as_other = client.get(f"/api/v1/eval-cases/{created['id']}")
    app.dependency_overrides[get_current_user] = lambda: test_user

    assert all(c["id"] != created["id"] for c in listed_as_other)
    assert viewed_as_other.status_code == 403

    # The author still sees their own case; the owner sees everything.
    assert any(c["id"] == created["id"] for c in client.get("/api/v1/eval-cases").json())
    owner = make_user(db_session, settings.owner_email, "Owner")
    app.dependency_overrides[get_current_user] = lambda: owner
    listed_as_owner = client.get("/api/v1/eval-cases").json()
    viewed_as_owner = client.get(f"/api/v1/eval-cases/{created['id']}")
    app.dependency_overrides[get_current_user] = lambda: test_user
    assert any(c["id"] == created["id"] for c in listed_as_owner)
    assert viewed_as_owner.status_code == 200


def test_case_count_is_public(unauthenticated_client):
    r = unauthenticated_client.get("/api/v1/eval-cases/count")
    assert r.status_code == 200
    assert isinstance(r.json()["count"], int)


# --- decomposition task (ADR-032) -------------------------------------------

RULEBOOK_MARKERS = ("sequencing", "named", "standardized unit", "selection", "parameter")


def decomp_payload(**overrides):
    payload = {"decision": "keep_whole", "split_count": None, "reason": "It is one decision."}
    payload.update(overrides)
    return payload


def test_items_fixed_and_rule_free(client):
    r = client.get("/api/v1/decomposition/items")
    assert r.status_code == 200
    body = r.json()
    assert body["total_items"] == 15
    flat = [i for g in body["groups"] for i in g["items"]]
    assert [i["id"] for i in flat] == list(range(1, 16))
    # The decomposition rules must appear nowhere rater-facing.
    blob = str(body).lower()
    assert not any(marker in blob for marker in RULEBOOK_MARKERS)


def test_items_require_auth(unauthenticated_client):
    assert unauthenticated_client.get("/api/v1/decomposition/items").status_code == 401


def test_upsert_and_revise_response(client):
    r = client.put("/api/v1/decomposition/responses/1", json=decomp_payload())
    assert r.status_code == 200, r.text
    assert r.json()["decision"] == "keep_whole"

    # Revising updates the same row, not a second one.
    r = client.put(
        "/api/v1/decomposition/responses/1",
        json=decomp_payload(
            decision="split", split_count=2,
            split_labels=["fluids first", "saline"],
            reason="Two separate checks.",
        ),
    )
    assert r.status_code == 200
    mine = client.get("/api/v1/decomposition/responses").json()
    assert len([m for m in mine if m["item_id"] == 1]) == 1
    assert mine[0]["decision"] == "split" and mine[0]["split_count"] == 2
    # The carve round-trips, in order.
    assert mine[0]["split_labels"] == ["fluids first", "saline"]

    # Revising back to keep_whole clears count and labels.
    r = client.put("/api/v1/decomposition/responses/1", json=decomp_payload())
    assert r.status_code == 200
    assert r.json()["split_count"] is None and r.json()["split_labels"] is None


def test_new_response_stamped_with_current_briefing(client):
    """Rating answers carry the briefing wording the rater actually read, so
    the two raters who finished under v1 stay separable in the analysis."""
    from clinicalguard.api.routers.decomposition import BRIEFING_VERSION

    r = client.put(
        "/api/v1/decomposition/responses/1",
        json={"decision": "keep_whole", "split_count": None, "split_labels": None, "reason": "One decision."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["briefing_version"] == BRIEFING_VERSION == "v2"


def test_revision_keeps_the_briefing_it_was_answered_under(client, db_session, test_user):
    """A revision does not reassign an answer to a briefing the rater never
    read — the v1 rows stay v1 even if their author edits them."""
    from clinicalguard.db.models import DecompositionResponse

    client.put(
        "/api/v1/decomposition/responses/2",
        json={"decision": "keep_whole", "split_count": None, "split_labels": None, "reason": "One decision."},
    )
    row = (
        db_session.query(DecompositionResponse)
        .filter_by(item_id=2, rater_user_id=test_user.id)
        .one()
    )
    row.briefing_version = "v1"
    db_session.commit()

    r = client.put(
        "/api/v1/decomposition/responses/2",
        json={"decision": "split", "split_count": 2, "split_labels": ["a", "b"], "reason": "Two decisions."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["briefing_version"] == "v1"


def test_export_carries_briefing_version(client, monkeypatch):
    monkeypatch.setattr(settings, "owner_email", "drtest@example.com")
    client.put(
        "/api/v1/decomposition/responses/3",
        json={"decision": "keep_whole", "split_count": None, "split_labels": None, "reason": "One decision."},
    )
    r = client.get("/api/v1/decomposition/export?format=csv")
    assert r.status_code == 200, r.text
    assert "briefing_version" in r.text.splitlines()[0]


def test_reason_required(client):
    r = client.put("/api/v1/decomposition/responses/2", json=decomp_payload(reason="   "))
    assert r.status_code == 422


def test_split_requires_count(client):
    r = client.put(
        "/api/v1/decomposition/responses/2",
        json=decomp_payload(decision="split", split_count=None, reason="Two things."),
    )
    assert r.status_code == 422


def test_split_requires_piece_labels(client):
    """A split with unlabeled pieces is the count without the carve —
    rejected. So is a label list that doesn't match the count, or one
    with a blank entry."""
    base = decomp_payload(decision="split", split_count=2, reason="Two things.")
    assert client.put("/api/v1/decomposition/responses/2", json=base).status_code == 422
    assert client.put(
        "/api/v1/decomposition/responses/2", json={**base, "split_labels": ["only one"]}
    ).status_code == 422
    assert client.put(
        "/api/v1/decomposition/responses/2", json={**base, "split_labels": ["one", "   "]}
    ).status_code == 422
    ok = client.put(
        "/api/v1/decomposition/responses/2", json={**base, "split_labels": ["one", "two"]}
    )
    assert ok.status_code == 200, ok.text


def test_unknown_item_404(client):
    assert client.put("/api/v1/decomposition/responses/99", json=decomp_payload()).status_code == 404


def test_responses_are_own_only(client, db_session, test_user):
    client.put("/api/v1/decomposition/responses/3", json=decomp_payload())

    other = make_user(db_session, "rater2@example.com", "Rater Two")
    app.dependency_overrides[get_current_user] = lambda: other
    others_view = client.get("/api/v1/decomposition/responses").json()
    app.dependency_overrides[get_current_user] = lambda: test_user
    assert others_view == []


def test_export_owner_only(client, db_session, test_user, monkeypatch):
    monkeypatch.setattr(settings, "owner_email", "owner-test@example.com")
    client.put(
        "/api/v1/decomposition/responses/4",
        json=decomp_payload(
            decision="split", split_count=2,
            split_labels=["fluids first", "saline"], reason="Two decisions.",
        ),
    )

    # A rater — even the one who answered — cannot read the aggregate.
    assert client.get("/api/v1/decomposition/export").status_code == 403

    owner = make_user(db_session, settings.owner_email, "Owner")
    app.dependency_overrides[get_current_user] = lambda: owner
    csv_r = client.get("/api/v1/decomposition/export")
    json_r = client.get("/api/v1/decomposition/export?format=json")
    app.dependency_overrides[get_current_user] = lambda: test_user

    assert csv_r.status_code == 200
    assert csv_r.headers["content-type"].startswith("text/csv")
    assert "split_labels" in csv_r.text.splitlines()[0]
    assert "fluids first | saline" in csv_r.text
    rows = json_r.json()["responses"]
    mine = next(r for r in rows if r["item_id"] == 4 and r["rater"] == TEST_AUTHOR_NAME)
    assert mine["split_labels"] == ["fluids first", "saline"]


# --- provenance is metadata, not a scoring input (ADR-033) --------------------

def test_guideline_provenance_does_not_change_scores(db_session, monkeypatch):
    """The provenance tier is descriptive metadata: it rides along in the case
    JSON for stratified reporting and no scoring path reads it. With the judge
    model stubbed, the same case scores identically with and without it — any
    future branch on the field would break this."""
    import json as _json

    from clinicalguard.retrieval import eval_scorer

    judged = {
        dim: {"critical_coverage": 0.8, "thoroughness": 0.5, "score": 0.0, "findings": []}
        for dim in ("treatment_correctness", "investigation_appropriateness", "completeness")
    }

    class _Msg:
        content = _json.dumps(judged)

    class _Choice:
        message = _Msg()

    class _Completion:
        choices = [_Choice()]

    monkeypatch.setattr(
        eval_scorer.client.chat.completions,
        "create",
        lambda **kwargs: _Completion(),
    )

    expected = {
        "query": "Adult with high fever — diagnosis and management",
        "expected_diagnoses": {"required": {"primary": "Severe malaria", "critical_differentials": []}},
        "required_investigations": {"required": ["Blood smear"], "expected": [], "situational": []},
        "required_treatments": {"required": ["Parenteral artesunate"], "expected": [], "situational": []},
        "provenance_notes": "Fully NSTG-grounded.",
    }
    args = ("Adult with high fever — diagnosis and management", "Give artesunate.", )

    without = eval_scorer.score_response_against_expected(
        *args, expected, [MALARIA_ID], db_session
    )
    with_tier = eval_scorer.score_response_against_expected(
        *args, {**expected, "guideline_provenance": "nstg_plus_other"}, [MALARIA_ID], db_session
    )

    assert with_tier.overall_score == without.overall_score
    assert with_tier == without


# --- server-side drafts (ADR-034) ---------------------------------------------

def _draft_body(**overrides):
    body = {
        "condition_ids": [{"condition_id": MALARIA_ID, "subtype": None}],
        "form_state": {"query": "Adult with fever", "primary": "", "archetypes": []},
        "screen_id": "1.2",
    }
    body.update(overrides)
    return body


def test_draft_upsert_creates_then_updates(client):
    """The client mints the id, so a draft keeps one identity across debounced
    saves rather than multiplying as the author types."""
    did = str(uuid.uuid4())

    r = client.put(f"/api/v1/drafts/{did}", json=_draft_body())
    assert r.status_code == 200, r.text
    assert r.json()["id"] == did
    assert r.json()["screen_id"] == "1.2"

    r = client.put(
        f"/api/v1/drafts/{did}",
        json=_draft_body(form_state={"query": "Adult with fever and altered consciousness"}, screen_id="2.7"),
    )
    assert r.status_code == 200, r.text
    assert r.json()["form_state"]["query"].endswith("altered consciousness")
    assert r.json()["screen_id"] == "2.7"

    listed = client.get("/api/v1/drafts").json()
    assert len([d for d in listed if d["id"] == did]) == 1


def test_draft_pristine_form_creates_nothing(client):
    """Opening a condition and backing out must not leave a draft behind — the
    client's autosave fires once on load with an empty form."""
    did = str(uuid.uuid4())
    r = client.put(
        f"/api/v1/drafts/{did}",
        json=_draft_body(form_state={"query": "", "primary": "   ", "archetypes": [], "safety_none_declared": False}),
    )
    assert r.status_code == 422
    assert client.get("/api/v1/drafts").status_code == 200
    assert all(d["id"] != did for d in client.get("/api/v1/drafts").json())


def test_draft_list_scoped_to_user(client, db_session, test_user, monkeypatch):
    """A rater sees their own unfinished cases and nobody else's."""
    from clinicalguard.api.deps import get_current_user
    from clinicalguard.api.main import app
    from clinicalguard.db.models import CaseDraft

    other = make_user(db_session, "someone.else@example.com", "Dr Other")
    db_session.add(
        CaseDraft(
            id=uuid.uuid4(),
            user_id=other.id,
            condition_ids=[{"condition_id": MALARIA_ID, "subtype": None}],
            form_state={"query": "not yours"},
            screen_id="1.1",
        )
    )
    db_session.commit()

    mine = str(uuid.uuid4())
    client.put(f"/api/v1/drafts/{mine}", json=_draft_body())

    listed = client.get("/api/v1/drafts").json()
    assert [d["id"] for d in listed] == [mine]
    assert all(d["form_state"].get("query") != "not yours" for d in listed)


def test_draft_cross_user_access_404(client, db_session, test_user):
    """Someone else's draft is not found, rather than forbidden — its existence
    is not a fact another user gets to learn."""
    from clinicalguard.db.models import CaseDraft

    other = make_user(db_session, "third.party@example.com", "Dr Third")
    theirs = uuid.uuid4()
    db_session.add(
        CaseDraft(
            id=theirs,
            user_id=other.id,
            condition_ids=[],
            form_state={"query": "not yours"},
            screen_id=None,
        )
    )
    db_session.commit()

    assert client.put(f"/api/v1/drafts/{theirs}", json=_draft_body()).status_code == 404
    assert client.delete(f"/api/v1/drafts/{theirs}").status_code == 404

    # And it survives the attempt.
    still = db_session.query(CaseDraft).filter_by(id=theirs).first()
    assert still is not None and still.form_state["query"] == "not yours"


def test_draft_delete(client):
    did = str(uuid.uuid4())
    client.put(f"/api/v1/drafts/{did}", json=_draft_body())
    assert client.delete(f"/api/v1/drafts/{did}").status_code == 204
    assert all(d["id"] != did for d in client.get("/api/v1/drafts").json())
    # Deleting an already-gone draft succeeds: the same cleanup may run twice.
    assert client.delete(f"/api/v1/drafts/{did}").status_code == 204


def test_submit_retires_its_draft(client):
    """Submitting a case clears the draft it came from, so a finished case
    does not linger in the author's unfinished list."""
    did = str(uuid.uuid4())
    client.put(f"/api/v1/drafts/{did}", json=_draft_body())
    assert any(d["id"] == did for d in client.get("/api/v1/drafts").json())

    r = client.post("/api/v1/eval-cases", json=valid_payload(draft_id=did))
    assert r.status_code == 201, r.text
    assert all(d["id"] != did for d in client.get("/api/v1/drafts").json())


def test_submit_without_draft_id_still_works(client):
    """An older client that sends no draft_id submits exactly as before."""
    r = client.post("/api/v1/eval-cases", json=valid_payload())
    assert r.status_code == 201, r.text


def test_drafts_require_auth(unauthenticated_client):
    assert unauthenticated_client.get("/api/v1/drafts").status_code == 401
    assert unauthenticated_client.put(
        f"/api/v1/drafts/{uuid.uuid4()}", json=_draft_body()
    ).status_code == 401


def test_draft_timestamps_carry_utc_offset(client):
    """Naive isoformat() is read as local time by the browser, which rendered a
    draft saved seconds ago as "1 hour ago" for anyone off UTC."""
    did = str(uuid.uuid4())
    body = client.put(f"/api/v1/drafts/{did}", json=_draft_body()).json()
    assert body["updated_at"].endswith("+00:00"), body["updated_at"]
    assert body["created_at"].endswith("+00:00"), body["created_at"]

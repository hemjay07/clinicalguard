"""Feedback capture: any signed-in user can leave a note; reading (list and
CSV export) is owner-only. Same rolled-back-transaction setup as test_api."""

from clinicalguard.api.deps import get_current_user
from clinicalguard.api.main import app
from clinicalguard.config import settings
from clinicalguard.db.models import Feedback

from .test_api import client, db_session, make_user, test_user  # noqa: F401


def test_note_saved_with_context(client, db_session, test_user):
    resp = client.post(
        "/api/v1/feedback",
        json={
            "flow": "decomposition",
            "context": "item 7 (step 7 of 15)",
            "note": "Not sure what counts as one decision here",
        },
    )
    assert resp.status_code == 204

    row = db_session.query(Feedback).filter_by(user_id=test_user.id).one()
    assert row.flow == "decomposition"
    assert row.context == "item 7 (step 7 of 15)"
    assert row.note == "Not sure what counts as one decision here"


def test_flow_and_note_validated(client):
    assert client.post("/api/v1/feedback", json={"flow": "other", "note": "x"}).status_code == 422
    assert client.post("/api/v1/feedback", json={"flow": "authoring", "note": "   "}).status_code == 422


def test_reading_is_owner_only(client, db_session, test_user, monkeypatch):
    monkeypatch.setattr(settings, "owner_email", "owner-test@example.com")
    client.post(
        "/api/v1/feedback",
        json={"flow": "authoring", "context": "screen 2.3", "note": "confusing"},
    )

    # A regular rater can write but never read — their own notes included.
    assert client.get("/api/v1/feedback").status_code == 403
    assert client.get("/api/v1/feedback/export").status_code == 403

    owner = make_user(db_session, settings.owner_email, "Owner")
    app.dependency_overrides[get_current_user] = lambda: owner
    try:
        rows = client.get("/api/v1/feedback").json()
        assert any(r["note"] == "confusing" and r["context"] == "screen 2.3" for r in rows)

        export = client.get("/api/v1/feedback/export")
        assert export.status_code == 200
        assert export.headers["content-type"].startswith("text/csv")
        assert "confusing" in export.text
    finally:
        app.dependency_overrides[get_current_user] = lambda: test_user

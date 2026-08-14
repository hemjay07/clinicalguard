"""Author profile metadata: cadre (once per author, validated categories)
and the contribute-more opt-in; authors export is owner-only."""

from clinicalguard.api.deps import get_current_user
from clinicalguard.api.main import app
from clinicalguard.config import settings

from .test_api import client, db_session, make_user, test_user  # noqa: F401


def test_cadre_set_and_validated(client):
    me = client.get("/api/v1/auth/me").json()
    assert me["cadre"] is None

    assert client.put("/api/v1/auth/me/cadre", json={"cadre": "Attending"}).status_code == 422
    assert client.put("/api/v1/auth/me/cadre", json={"cadre": "Other", "cadre_other": " "}).status_code == 422

    resp = client.put("/api/v1/auth/me/cadre", json={"cadre": "Registrar"})
    assert resp.status_code == 200
    assert resp.json()["cadre"] == "Registrar"
    assert resp.json()["cadre_other"] is None

    other = client.put(
        "/api/v1/auth/me/cadre", json={"cadre": "Other", "cadre_other": "Pharmacist"}
    ).json()
    assert other["cadre"] == "Other" and other["cadre_other"] == "Pharmacist"


def test_contribute_opt_in(client):
    assert client.get("/api/v1/auth/me").json()["contribute_opt_in"] is False
    resp = client.post("/api/v1/auth/me/contribute-interest")
    assert resp.status_code == 200
    assert resp.json()["contribute_opt_in"] is True


def test_authors_export_owner_only(client, db_session, test_user, monkeypatch):
    monkeypatch.setattr(settings, "owner_email", "owner-test@example.com")
    client.put("/api/v1/auth/me/cadre", json={"cadre": "Consultant"})
    client.post("/api/v1/auth/me/contribute-interest")

    assert client.get("/api/v1/auth/authors/export").status_code == 403

    owner = make_user(db_session, settings.owner_email, "Owner")
    app.dependency_overrides[get_current_user] = lambda: owner
    try:
        resp = client.get("/api/v1/auth/authors/export")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        row = next(l for l in resp.text.splitlines() if test_user.email in l)
        assert "Consultant" in row and "True" in row
    finally:
        app.dependency_overrides[get_current_user] = lambda: test_user

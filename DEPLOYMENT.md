# Deployment — ClinicalGuard MD-Authoring UI (Phase A)

Two pieces are deployed:

- **Backend** — FastAPI app (`clinicalguard/api`) → **Render** (free web service)
- **Frontend** — React/Vite SPA (`frontend/`) → **Vercel**

Both auto-deploy from GitHub on push to the connected branch. No authentication is
configured (Phase A relies on URL obscurity — see ADR-019).

---

## 1. Backend → Render

### Config in the repo
- `render.yaml` — build command (`pip install .`), start command, `/health` check,
  Python version, and the env vars (secrets are entered in the dashboard).

Start command: `uvicorn clinicalguard.api.main:app --host 0.0.0.0 --port $PORT`
(Render provides `$PORT`).

### One-time setup (dashboard)
1. <https://dashboard.render.com> → **New** → **Web Service** → connect the
   `hemjay07/clinicalguard` repo (authorize GitHub if prompted).
2. Pick the branch to deploy (`main`, or `phase-a-authoring-ui` before merge).
3. Render reads `render.yaml`. Confirm: Runtime **Python**, Build `pip install .`,
   Start `uvicorn clinicalguard.api.main:app --host 0.0.0.0 --port $PORT`, Plan **Free**.
4. Add the secret environment variables (values are in your local `.env`):
   `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Leave `FRONTEND_ORIGIN`
   empty for now — set it after the frontend is deployed.
5. Create the service. First build takes a few minutes.

> **Free tier note:** the service spins down after ~15 min idle; the next request
> cold-starts in ~30–60s, then is fast again. Fine for Phase A.

### Verify
```bash
curl https://<your-service>.onrender.com/health      # -> {"status":"ok"}
curl https://<your-service>.onrender.com/api/v1/conditions | head   # 251 conditions
```
Interactive API docs: `https://<your-service>.onrender.com/docs`.

---

## 2. Frontend → Vercel

### Config in the repo
- `frontend/vercel.json` — Vite preset + SPA rewrite (so client routes like
  `/author/149` serve `index.html`).

### One-time setup
1. <https://vercel.com> → **Add New… → Project** → import `hemjay07/clinicalguard`.
2. **Set Root Directory to `frontend`** (the app lives in a subdirectory — key step).
3. Framework preset **Vite** is auto-detected (build `npm run build`, output `dist`).
4. Add env var `VITE_API_URL` = the Render backend URL (no trailing slash),
   e.g. `https://clinicalguard-api.onrender.com`.
5. Deploy.

### CLI alternative
```bash
npm i -g vercel
cd frontend
vercel            # link/create the project; Root Directory = .
echo "https://<render-service>.onrender.com" | vercel env add VITE_API_URL production
vercel --prod
```

### Verify
Open the Vercel URL — the home page shows live stats fetched from the backend.

---

## 3. Wire CORS (after both are up)

The backend only allows the specific frontend origin (never `*`).

1. Set `FRONTEND_ORIGIN` on **Render** to the exact Vercel URL
   (`https://clinicalguard.vercel.app`) → Render redeploys on the change.
2. Set `VITE_API_URL` on **Vercel** to the Render URL → redeploy.

Localhost origins (`http://localhost:5173`) are always allowed, so local dev works
without configuration.

**If the frontend URL changes:** update `FRONTEND_ORIGIN` on Render to the new
origin. Multiple origins can be comma-separated:
`FRONTEND_ORIGIN=https://a.vercel.app,https://b.vercel.app`.

---

## 4. End-to-end check

1. `curl https://<render>/health` → `{"status":"ok"}`.
2. Open the Vercel URL → home stats load (no CORS error in the browser console).
3. Author Case → search "Malaria" → subtype "Severe (Complicated) malaria" →
   the source panel populates with NSTG data.
4. Fill query, expected diagnosis, at least one required investigation/treatment,
   a situational item (`CSF analysis — trigger: AI raises meningitis`) → Submit.
5. Submitted Cases → the new case appears → open it for the read-only view.

---

## Local development

```bash
# Backend (repo root, venv active)
uvicorn clinicalguard.api.main:app --reload --port 8011

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```
`frontend/.env` defaults `VITE_API_URL` to `http://localhost:8011`.

## Notes / troubleshooting
- **Build can't find the package:** the build command is `pip install .`; the
  package `clinicalguard` is auto-detected by hatchling from `pyproject.toml`.
- **DB:** Supabase is already provisioned; the backend connects via `DATABASE_URL`.
  No new database setup is needed.

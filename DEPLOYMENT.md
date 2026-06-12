# Deployment — ClinicalGuard MD-Authoring UI (Phase A)

Two pieces are deployed:

- **Backend** — FastAPI app (`clinicalguard/api`) → **Railway**
- **Frontend** — React/Vite SPA (`frontend/`) → **Vercel**

Both auto-deploy from GitHub on push to `main`. No authentication is configured
(Phase A relies on URL obscurity — see ADR-019).

---

## 1. Backend → Railway

### Config in the repo
- `railway.json` — builder + start command + `/health` health check.
- `nixpacks.toml` — installs the package (`pip install .`) and runs uvicorn.

Start command: `uvicorn clinicalguard.api.main:app --host 0.0.0.0 --port $PORT`
(Railway provides `$PORT`).

### One-time setup
1. Create a project at <https://railway.app> → **Deploy from GitHub repo** → pick
   `hemjay07/clinicalguard`. Leave the root directory as the repo root.
2. Add environment variables (Railway → service → **Variables**):

   | Variable | Value | Where to get it |
   |---|---|---|
   | `DATABASE_URL` | Supabase Postgres URL | Supabase → Project → Settings → Database → Connection string (URI). Same value as local `.env`. |
   | `OPENAI_API_KEY` | OpenAI key | Existing project key (used by the scorer/safety engine, not the authoring path). |
   | `ANTHROPIC_API_KEY` | Anthropic key | Existing project key. |
   | `FRONTEND_ORIGIN` | Vercel URL | Set after the frontend is deployed, e.g. `https://clinicalguard.vercel.app`. Comma-separate multiple. |

3. Deploy. Railway builds with Nixpacks and starts uvicorn.

### CLI alternative (run these yourself — they need an interactive login)
```bash
npm i -g @railway/cli
railway login            # opens a browser
railway init             # or `railway link` to an existing project
railway up               # build & deploy
railway variables set DATABASE_URL=... OPENAI_API_KEY=... ANTHROPIC_API_KEY=... FRONTEND_ORIGIN=...
```

### Verify
```bash
curl https://<your-app>.up.railway.app/health
# -> {"status":"ok"}
curl https://<your-app>.up.railway.app/api/v1/conditions | head
# -> JSON array of 251 conditions
```
Interactive docs are at `https://<your-app>.up.railway.app/docs`.

---

## 2. Frontend → Vercel

### Config in the repo
- `frontend/vercel.json` — Vite framework preset + SPA rewrite (so client routes
  like `/author/149` serve `index.html`).

### One-time setup
1. Create a project at <https://vercel.com> → **Import** `hemjay07/clinicalguard`.
2. **Set Root Directory to `frontend`** (Project Settings → General → Root
   Directory). This is the key step — the app lives in a subdirectory.
3. Framework preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
4. Add an environment variable:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | The Railway backend URL, e.g. `https://<your-app>.up.railway.app` (no trailing slash) |

5. Deploy.

### CLI alternative (interactive login)
```bash
npm i -g vercel
cd frontend
vercel            # first run links/creates the project; set root dir = . here
vercel env add VITE_API_URL production   # paste the Railway URL
vercel --prod
```

### Verify
Open the Vercel URL. The home page should show live stats (251 conditions, the
safety-rule count, submitted-case count) fetched from the backend.

---

## 3. Wire CORS (after both are up)

The backend only allows the specific frontend origin (never `*`).

1. Set `FRONTEND_ORIGIN` on **Railway** to the exact Vercel URL
   (`https://clinicalguard.vercel.app`). Redeploy the backend (Railway redeploys
   on a variable change).
2. Set `VITE_API_URL` on **Vercel** to the Railway URL. Redeploy the frontend.

Localhost origins (`http://localhost:5173`) are always allowed, so local dev
keeps working without configuration.

**If the frontend URL changes** (e.g. a new Vercel domain or preview URL): update
`FRONTEND_ORIGIN` on Railway to the new origin and redeploy. To allow several
origins, comma-separate them: `FRONTEND_ORIGIN=https://a.vercel.app,https://b.vercel.app`.

---

## 4. End-to-end check

1. `curl https://<railway>/health` → `{"status":"ok"}`.
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
- **Railway build fails to find the package:** confirm `nixpacks.toml` ran
  `pip install .`; the package is `clinicalguard` (auto-detected by hatchling).
- **Free-tier cold starts:** the first request after idle may be slow; the home
  page already tolerates a few seconds of latency on the stat fetch.
- **DB:** Supabase is already provisioned; no new database setup is needed — the
  backend connects via `DATABASE_URL`.

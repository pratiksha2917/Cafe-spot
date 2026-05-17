# CafeSpot

Find the best cafes in Sydney within 5km of any suburb, sorted closest to farthest.

## Features

- **Authentication** — Register / login with JWT. Sessions persist across browser refreshes.
- **Suburb search** — Type any Sydney suburb with live autocomplete.
- **Cafe results** — Up to 60 cafes sorted by driving distance (closest first).
- **Google Maps** — Interactive map with numbered markers matching each result.
- **Filters** — Filter by Open Now, minimum rating, and price level.
- **Cafe details** — Photos, opening hours, phone, website, reviews, Street View.
- **Favourites** — Save and manage favourite cafes per user account.
- **Fully Dockerised** — Backend + frontend in separate containers via docker-compose.
- **CI/CD** — Jenkins pipeline with lint, dependency install, Docker build, health check, and deploy stages.

## Project structure

```
cafespot/
├── backend/
│   ├── app.py              Flask API + JWT auth
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html          Login / register page
│   ├── dashboard.html      Main app
│   ├── css/style.css
│   ├── js/
│   │   ├── config.js       API base URL + Google Maps key
│   │   ├── auth.js         JWT login / register / logout
│   │   ├── api.js          All backend calls
│   │   ├── ui.js           DOM rendering helpers
│   │   └── app.js          Application logic + Google Maps
│   ├── nginx.conf          Proxies /api/* to backend container
│   └── Dockerfile
├── docker-compose.yml
├── Jenkinsfile
└── README.md
```

## Quick start (Docker)

```bash
# 1. Clone or copy this folder into your VM
# 2. Run:
docker compose up -d --build

# Frontend: http://localhost:8081
# Backend:  http://localhost:5000
# Health:   http://localhost:5000/api/health
```

## Jenkins CI/CD setup

1. Start Jenkins and install plugins: **Git**, **Pipeline**, **Docker Pipeline**
2. Create a new **Pipeline** job
3. Under Pipeline → Definition → select **Pipeline script from SCM**
4. SCM: **Git** → `https://github.com/jnicolette/cafespot.git`
5. Branch: `*/main`
6. Script Path: `Jenkinsfile`
7. Save → **Build Now**

### Pipeline stages

| Stage | What it does |
|---|---|
| Checkout | Pulls latest code from GitHub |
| Lint & Validate | Checks Python syntax + required files exist |
| Install Dependencies | pip installs backend packages |
| Build Docker Images | Builds backend and frontend images |
| Test Backend Health | Runs backend container, hits /api/health |
| Deploy | docker compose up -d --build |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | dev-secret | JWT signing key — **change in production** |
| `GOOGLE_API_KEY` | (included) | Google Maps API key |
| `DB_PATH` | /app/data/cafespot.db | SQLite database path |

## Stopping the app

```bash
docker compose down
```

To also remove stored user data:

```bash
docker compose down -v
```

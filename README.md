# Strava Heatmap

## Setup

### 1. Strava API App
1. Go to https://www.strava.com/settings/api
2. Create an app — set **Authorization Callback Domain** to `localhost`
3. Copy your **Client ID** and **Client Secret**

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env

uvicorn main:app --reload
```

### 3. Test
Open http://localhost:8000 → click "Connect Strava" → authorize → then visit:
- `/api/activities` — first 10 runs (raw)
- `/api/stats` — km per city + km per year for ALL your runs

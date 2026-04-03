import os
import asyncio
import httpx
import polyline
from datetime import date
from fastapi import FastAPI, Request, Response, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_pool, create_tables

load_dotenv()

app = FastAPI(title="Strava Heatmap")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://feisty-exploration-production-f4e0.up.railway.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

STRAVA_CLIENT_ID     = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI         = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
MAPBOX_TOKEN         = os.getenv("MAPBOX_TOKEN")
WEBHOOK_VERIFY_TOKEN = os.getenv("STRAVA_WEBHOOK_VERIFY_TOKEN", "heatrun_webhook")

# Temporary in-memory token store (one user, testing only)
token_store: dict = {}


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html><body>
        <h2>Strava Heatmap</h2>
        <a href="/auth/login"><button>Connect Strava</button></a>
    </body></html>
    """


@app.get("/auth/login")
async def login():
    url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        "&scope=activity:read_all"
    )
    return RedirectResponse(url)


@app.get("/auth/callback")
async def callback(code: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id":     STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "code":          code,
                "grant_type":    "authorization_code",
            },
        )

    data = resp.json()
    if "access_token" not in data:
        return JSONResponse({"error": "Token exchange failed", "detail": data}, status_code=400)

    athlete = data.get("athlete", {})
    token_store["access_token"]  = data["access_token"]
    token_store["refresh_token"] = data["refresh_token"]
    token_store["athlete"]       = athlete

    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO users (id, firstname, lastname, access_token, refresh_token, profile)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE
            SET access_token  = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                profile       = EXCLUDED.profile
        """,
        athlete["id"],
        athlete.get("firstname"),
        athlete.get("lastname"),
        data["access_token"],
        data["refresh_token"],
        athlete.get("profile"),
    )

    response = RedirectResponse("https://feisty-exploration-production-f4e0.up.railway.app")
    response.set_cookie("athlete_id", str(athlete["id"]), max_age=60*60*24*30, httponly=True, samesite="none", secure=True)
    return response


@app.get("/test", response_class=HTMLResponse)
async def test_page():
    if "access_token" not in token_store:
        return HTMLResponse("<p>Not connected. <a href='/auth/login'>Connect Strava</a></p>")

    athlete  = token_store.get("athlete", {})
    user_id  = athlete.get("id")
    name     = f"{athlete.get('firstname', '')} {athlete.get('lastname', '')}".strip()

    pool  = await get_pool()
    count = await pool.fetchval("SELECT COUNT(*) FROM runs WHERE user_id = $1", user_id)

    return f"""
    <html><body>
        <h2>Connected as: {name}</h2>
        <p>Your runs in database: <strong>{count}</strong></p>
        <ul>
            <li><a href="/api/import">Import all your runs from Strava → DB</a></li>
            <li><a href="/geocode">Assign cities to runs (with progress bar)</a></li>
            <li><a href="/api/stats">Stats: km per city + km per year</a></li>
        </ul>
    </body></html>
    """


async def fetch_page(client: httpx.AsyncClient, access_token: str, page: int) -> list:
    resp = await client.get(
        "https://www.strava.com/api/v3/athlete/activities",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"per_page": 100, "page": page},
    )
    activities = resp.json()
    if not isinstance(activities, list):
        return []
    return [a for a in activities if a.get("type") == "Run"]


async def get_valid_token() -> str | None:
    """Return a valid access token, refreshing if expired."""
    if "access_token" not in token_store:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        test = await client.get(
            "https://www.strava.com/api/v3/athlete",
            headers={"Authorization": f"Bearer {token_store['access_token']}"},
        )
        if test.status_code == 200:
            return token_store["access_token"]
        # Token expired — refresh it
        resp = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id":     STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "grant_type":    "refresh_token",
                "refresh_token": token_store["refresh_token"],
            },
        )
        tokens = resp.json()
        if "access_token" not in tokens:
            return None
        token_store["access_token"]  = tokens["access_token"]
        token_store["refresh_token"] = tokens["refresh_token"]
        # Persist to DB
        pool = await get_pool()
        await pool.execute(
            "UPDATE users SET access_token = $1, refresh_token = $2 WHERE id = $3",
            tokens["access_token"], tokens["refresh_token"], token_store["athlete"]["id"],
        )
        return tokens["access_token"]


@app.get("/api/import")
async def import_runs():
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    access_token = await get_valid_token()
    if not access_token:
        return JSONResponse({"error": "Token refresh failed"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    async with httpx.AsyncClient(timeout=30) as client:
        tasks   = [fetch_page(client, access_token, p) for p in range(1, 51)]
        results = await asyncio.gather(*tasks)

    all_runs = []
    for page_runs in results:
        all_runs.extend(page_runs)

    existing_ids = set(
        r["id"] for r in await pool.fetch(
            "SELECT id FROM runs WHERE user_id = $1", user_id
        )
    )

    new_runs = [r for r in all_runs if r["id"] not in existing_ids]

    if new_runs:
        records = [
            (
                run["id"],
                user_id,
                run["name"],
                date.fromisoformat(run["start_date_local"][:10]),
                int(run["start_date_local"][:4]),
                round(run["distance"] / 1000, 2),
                run.get("location_city"),
                run.get("location_country"),
                run.get("map", {}).get("summary_polyline"),
            )
            for run in new_runs
        ]

        await pool.copy_records_to_table(
            "runs",
            records=records,
            columns=["id", "user_id", "name", "date", "year", "distance_km", "city", "country", "polyline"],
        )

    total = await pool.fetchval("SELECT COUNT(*) FROM runs WHERE user_id = $1", user_id)

    return {
        "inserted":    len(new_runs),
        "skipped":     len(all_runs) - len(new_runs),
        "total_in_db": total,
    }


@app.get("/api/me")
async def get_me(request: Request):
    # If server restarted and token_store is empty, restore from DB via cookie
    if "access_token" not in token_store:
        athlete_id = request.cookies.get("athlete_id")
        if athlete_id:
            pool = await get_pool()
            user = await pool.fetchrow(
                "SELECT id, firstname, lastname, access_token, refresh_token FROM users WHERE id = $1",
                int(athlete_id),
            )
            if user:
                token_store["access_token"]  = user["access_token"]
                token_store["refresh_token"] = user["refresh_token"]
                token_store["athlete"] = {
                    "id":        user["id"],
                    "firstname": user["firstname"],
                    "lastname":  user["lastname"],
                    "profile":   user["profile"],
                }

    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    athlete = token_store.get("athlete", {})
    return {
        "id":        athlete.get("id"),
        "firstname": athlete.get("firstname"),
        "lastname":  athlete.get("lastname"),
        "profile":   athlete.get("profile"),
    }


@app.post("/auth/logout")
async def logout(response: Response):
    token_store.clear()
    response.delete_cookie("athlete_id")
    return {"ok": True}


@app.get("/api/stats")
async def get_stats(year: int = None):
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    base   = "WHERE user_id = $1"
    params = [user_id]

    if year:
        base  += " AND year = $2"
        params = [user_id, year]

    total = await pool.fetchrow(
        f"SELECT COUNT(*) as runs, ROUND(SUM(distance_km)::numeric, 2) as km FROM runs {base}",
        *params,
    )

    city_rows = await pool.fetch(
        f"""
        SELECT COALESCE(city, 'Unverified') as city, ROUND(SUM(distance_km)::numeric, 2) as km
        FROM runs {base}
        GROUP BY city ORDER BY km DESC
        """,
        *params,
    )

    year_rows = await pool.fetch(
        "SELECT year, ROUND(SUM(distance_km)::numeric, 2) as km FROM runs WHERE user_id = $1 GROUP BY year ORDER BY year",
        user_id,
    )

    return {
        "filter_year": year,
        "total_runs":  total["runs"],
        "total_km":    total["km"],
        "km_per_city": {r["city"]: float(r["km"]) for r in city_rows},
        "km_per_year": {r["year"]: float(r["km"]) for r in year_rows},
    }


@app.get("/api/cities")
async def get_cities(year: int = None):
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    where  = "WHERE user_id = $1"
    params = [user_id]

    if year:
        where += " AND year = $2"
        params.append(year)

    # Fetch all runs (including NULL city = Unverified)
    rows = await pool.fetch(
        f"SELECT city, distance_km, polyline FROM runs {where}", *params
    )

    cities: dict[str, dict] = {}
    for row in rows:
        city = row["city"] or "Unverified"
        if city not in cities:
            cities[city] = {"km": 0.0, "runs": 0, "lats": [], "lngs": []}
        cities[city]["km"]   += row["distance_km"]
        cities[city]["runs"] += 1

        if row["polyline"] and row["polyline"].strip():
            try:
                coords = polyline.decode(row["polyline"])
                if coords:
                    lat, lng = coords[0]
                    cities[city]["lats"].append(lat)
                    cities[city]["lngs"].append(lng)
            except Exception:
                pass

    result = []
    unverified = None

    for city, data in sorted(cities.items(), key=lambda x: -x[1]["km"]):
        center_lat = sum(data["lats"]) / len(data["lats"]) if data["lats"] else None
        center_lng = sum(data["lngs"]) / len(data["lngs"]) if data["lngs"] else None
        entry = {
            "city":       city,
            "km":         round(data["km"], 2),
            "runs":       data["runs"],
            "center_lat": center_lat,
            "center_lng": center_lng,
        }
        if city == "Unverified":
            unverified = entry
        else:
            result.append(entry)

    # Unverified always goes at the end
    if unverified:
        result.append(unverified)

    return {"cities": result}


@app.get("/api/heatmap")
async def get_heatmap(city: str = None, year: int = None):
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    conditions = ["user_id = $1", "polyline IS NOT NULL", "polyline != ''"]
    params: list = [user_id]

    if city and city != "All":
        if city == "Unverified":
            conditions.append("city IS NULL")
        else:
            params.append(city)
            conditions.append(f"city = ${len(params)}")

    if year:
        params.append(year)
        conditions.append(f"year = ${len(params)}")

    where = "WHERE " + " AND ".join(conditions)
    rows  = await pool.fetch(f"SELECT polyline FROM runs {where}", *params)

    features = []
    for row in rows:
        try:
            coords = polyline.decode(row["polyline"])
            for lat, lng in coords[::2]:
                features.append({
                    "type":       "Feature",
                    "geometry":   {"type": "Point", "coordinates": [lng, lat]},
                    "properties": {}
                })
        except Exception:
            pass

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/records")
async def get_records(year: int = None):
    """Personal records: longest single run and best km month."""
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    where  = "WHERE user_id = $1"
    params = [user_id]
    if year:
        where += " AND year = $2"
        params.append(year)

    longest = await pool.fetchrow(
        f"SELECT name, date, distance_km, COALESCE(city, 'Unverified') as city "
        f"FROM runs {where} ORDER BY distance_km DESC LIMIT 1",
        *params,
    )

    best_month = await pool.fetchrow(
        f"SELECT year, EXTRACT(MONTH FROM date)::int as month, "
        f"ROUND(SUM(distance_km)::numeric, 1) as km "
        f"FROM runs {where} GROUP BY year, month ORDER BY km DESC LIMIT 1",
        *params,
    )

    return {
        "longest_run": {
            "distance_km": round(float(longest["distance_km"]), 1) if longest else None,
            "name":        longest["name"]  if longest else None,
            "date":        str(longest["date"]) if longest else None,
            "city":        longest["city"]  if longest else None,
        },
        "best_month": {
            "year":  best_month["year"]          if best_month else None,
            "month": best_month["month"]         if best_month else None,
            "km":    float(best_month["km"])     if best_month else None,
        },
    }


@app.get("/api/monthly")
async def get_monthly(year: int = None):
    """km per month (12-value array) for the given year (defaults to most recent)."""
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    if not year:
        year = await pool.fetchval(
            "SELECT MAX(year) FROM runs WHERE user_id = $1", user_id
        )

    rows = await pool.fetch(
        "SELECT EXTRACT(MONTH FROM date)::int as month, "
        "ROUND(SUM(distance_km)::numeric, 1) as km "
        "FROM runs WHERE user_id = $1 AND year = $2 "
        "GROUP BY EXTRACT(MONTH FROM date) ORDER BY 1",
        user_id, year,
    )

    months = [0.0] * 12
    for row in rows:
        months[row["month"] - 1] = float(row["km"])

    return {"year": year, "months": months}


# ── Strava Webhook ────────────────────────────────────────────────────────────

@app.get("/webhook")
async def webhook_verify(
    hub_mode:         str = Query(None, alias="hub.mode"),
    hub_challenge:    str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """Strava subscription verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == WEBHOOK_VERIFY_TOKEN:
        return JSONResponse({"hub.challenge": hub_challenge})
    return JSONResponse({"error": "Verification failed"}, status_code=403)


@app.post("/webhook")
async def webhook_event(request: Request):
    """Handle incoming Strava activity events (new run → insert into DB)."""
    data = await request.json()

    # Only care about new activities
    if data.get("object_type") != "activity" or data.get("aspect_type") != "create":
        return {"status": "ignored"}

    athlete_id  = data.get("owner_id")
    activity_id = data.get("object_id")

    pool = await get_pool()

    user = await pool.fetchrow(
        "SELECT access_token, refresh_token FROM users WHERE id = $1", athlete_id
    )
    if not user:
        return {"status": "unknown_user"}

    access_token = user["access_token"]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://www.strava.com/api/v3/activities/{activity_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        # Token expired — refresh and retry
        if resp.status_code == 401:
            refresh = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id":     STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "grant_type":    "refresh_token",
                    "refresh_token": user["refresh_token"],
                },
            )
            tokens = refresh.json()
            if "access_token" not in tokens:
                return {"status": "token_refresh_failed"}

            access_token = tokens["access_token"]
            await pool.execute(
                "UPDATE users SET access_token = $1, refresh_token = $2 WHERE id = $3",
                tokens["access_token"], tokens["refresh_token"], athlete_id,
            )
            # Sync in-memory store if this is the active session user
            if token_store.get("athlete", {}).get("id") == athlete_id:
                token_store["access_token"]  = tokens["access_token"]
                token_store["refresh_token"] = tokens["refresh_token"]

            resp = await client.get(
                f"https://www.strava.com/api/v3/activities/{activity_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if resp.status_code != 200:
            return {"status": f"fetch_failed_{resp.status_code}"}

        run = resp.json()

    if run.get("type") != "Run":
        return {"status": "not_a_run"}

    try:
        await pool.execute(
            """
            INSERT INTO runs (id, user_id, name, date, year, distance_km, city, country, polyline)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
            """,
            run["id"],
            athlete_id,
            run["name"],
            date.fromisoformat(run["start_date_local"][:10]),
            int(run["start_date_local"][:4]),
            round(run["distance"] / 1000, 2),
            run.get("location_city"),
            run.get("location_country"),
            run.get("map", {}).get("summary_polyline"),
        )
    except Exception as e:
        return {"status": f"insert_failed: {e}"}

    print(f"[WEBHOOK] New run added: {run['name']} ({run['distance']/1000:.1f} km) for athlete {athlete_id}")

    # Auto-geocode the new run immediately
    poly = run.get("map", {}).get("summary_polyline")
    if poly:
        try:
            coords = polyline.decode(poly)
            if coords:
                lat, lng = coords[0]
                semaphore = asyncio.Semaphore(1)
                async with httpx.AsyncClient(timeout=10) as gc_client:
                    city = await fetch_city_for_coords(gc_client, semaphore, lat, lng)
                    if city:
                        await pool.execute(
                            "UPDATE runs SET city = $1 WHERE id = $2",
                            city, run["id"]
                        )
                        print(f"[WEBHOOK] Geocoded to: {city}")
        except Exception as e:
            print(f"[WEBHOOK] Geocode failed: {e}")

    return {"status": "ok", "activity_id": activity_id}


# ── Geocoding ─────────────────────────────────────────────────────────────────

async def fetch_city_for_coords(client: httpx.AsyncClient, semaphore: asyncio.Semaphore, lat: float, lng: float) -> str | None:
    try:
        async with semaphore:
            resp = await client.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json",
                params={"types": "place", "access_token": MAPBOX_TOKEN},
            )
            await asyncio.sleep(0.1)

        if resp.status_code == 429:
            print(f"[RATE LIMIT] ({lat}, {lng})")
            return None
        if resp.status_code != 200:
            print(f"[ERROR] ({lat}, {lng}) — HTTP {resp.status_code}")
            return None

        features = resp.json().get("features", [])
        return features[0]["text"] if features else None
    except Exception as e:
        print(f"[EXCEPTION] ({lat}, {lng}): {e}")
        return None


@app.get("/geocode", response_class=HTMLResponse)
async def geocode_page():
    return """
    <html>
    <head>
        <title>Geocoding runs...</title>
        <style>
            body { font-family: sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; }
            #bar-wrap { background: #eee; border-radius: 8px; height: 28px; overflow: hidden; margin: 20px 0; }
            #bar { height: 100%; width: 0%; background: #fc4c02; transition: width 0.3s; border-radius: 8px; }
            #status { color: #555; font-size: 14px; }
            #done { display: none; color: green; font-weight: bold; margin-top: 16px; }
        </style>
    </head>
    <body>
        <h2>Assigning cities to your runs</h2>
        <div id="bar-wrap"><div id="bar"></div></div>
        <p id="status">Starting...</p>
        <p id="done">Done! <a href="/api/stats">View stats</a></p>

        <script>
            const bar = document.getElementById('bar');
            const status = document.getElementById('status');
            const done = document.getElementById('done');

            const es = new EventSource('/api/geocode/stream');

            es.addEventListener('progress', e => {
                const d = JSON.parse(e.data);
                const pct = Math.round((d.done / d.total) * 100);
                bar.style.width = pct + '%';
                let msg = `${d.done} / ${d.total} runs processed (${pct}%)`;
                if (d.api_calls) msg += ` — ${d.calls_done || 0} / ${d.api_calls} unique locations looked up`;
                status.textContent = msg;
            });

            es.addEventListener('complete', e => {
                const d = JSON.parse(e.data);
                bar.style.width = '100%';
                status.textContent = `Finished! ${d.updated} runs assigned a city. Only ${d.api_calls} API calls needed (location grouping).`;
                done.style.display = 'block';
                es.close();
            });

            es.onerror = () => {
                status.textContent = 'Connection lost.';
                es.close();
            };
        </script>
    </body>
    </html>
    """


@app.get("/api/geocode/count")
async def geocode_count():
    """How many runs still need city assignment."""
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()
    count   = await pool.fetchval(
        "SELECT COUNT(*) FROM runs WHERE user_id = $1 AND city IS NULL AND polyline IS NOT NULL AND polyline != ''",
        user_id,
    )
    return {"count": count}


@app.get("/api/geocode/stream")
async def geocode_stream():
    if "access_token" not in token_store:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    user_id = token_store["athlete"]["id"]
    pool    = await get_pool()

    rows = await pool.fetch(
        "SELECT id, polyline FROM runs WHERE user_id = $1 AND city IS NULL AND polyline IS NOT NULL AND polyline != ''",
        user_id,
    )

    async def event_stream():
        import json

        if not rows:
            yield f"event: complete\ndata: {json.dumps({'updated': 0, 'no_city': 0, 'api_calls': 0})}\n\n"
            return

        location_to_runs: dict[tuple, list[int]] = {}
        no_gps = []

        for row in rows:
            try:
                coords = polyline.decode(row["polyline"])
                if not coords:
                    no_gps.append(row["id"])
                    continue
                lat, lng = coords[0]
                key = (round(lat, 2), round(lng, 2))
                location_to_runs.setdefault(key, []).append(row["id"])
            except Exception:
                no_gps.append(row["id"])

        unique_locations = list(location_to_runs.keys())
        total_calls = len(unique_locations)
        total_runs  = len(rows)

        yield f"event: progress\ndata: {json.dumps({'done': 0, 'total': total_runs, 'api_calls': total_calls})}\n\n"

        semaphore  = asyncio.Semaphore(10)
        calls_done = 0
        runs_done  = 0

        async def geocode_with_key(client, lat, lng):
            city = await fetch_city_for_coords(client, semaphore, lat, lng)
            return (lat, lng), city

        async with httpx.AsyncClient(timeout=10) as client:
            tasks = [
                asyncio.ensure_future(geocode_with_key(client, lat, lng))
                for lat, lng in unique_locations
            ]

            for coro in asyncio.as_completed(tasks):
                key, city = await coro
                calls_done += 1

                run_ids    = location_to_runs[key]
                runs_done += len(run_ids)

                if city:
                    await pool.executemany(
                        "UPDATE runs SET city = $1 WHERE id = $2",
                        [(city, rid) for rid in run_ids],
                    )

                if calls_done % 5 == 0 or calls_done == total_calls:
                    yield f"event: progress\ndata: {json.dumps({'done': runs_done, 'total': total_runs, 'api_calls': total_calls, 'calls_done': calls_done})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'updated': runs_done, 'no_city': len(no_gps), 'api_calls': total_calls})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

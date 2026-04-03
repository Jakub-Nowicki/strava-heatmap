import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

_pool = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, ssl="require")
    return _pool


async def create_tables():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              BIGINT PRIMARY KEY,  -- Strava athlete ID
                firstname       TEXT,
                lastname        TEXT,
                access_token    TEXT,
                refresh_token   TEXT
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id          BIGINT PRIMARY KEY,      -- Strava activity ID
                user_id     BIGINT REFERENCES users(id),
                name        TEXT,
                date        DATE,
                year        INT,
                distance_km FLOAT,
                city        TEXT,
                country     TEXT,
                polyline    TEXT
            )
        """)

        # Add profile column if it doesn't exist yet (migration)
        await conn.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS profile TEXT
        """)

        # Index so per-user queries are fast
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS runs_user_id_idx ON runs(user_id)
        """)

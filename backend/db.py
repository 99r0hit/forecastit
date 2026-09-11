import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)

DB_URL = os.getenv("DATABASE_URL")
if DB_URL and DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DB_URL, pool_size=10, max_overflow=20)

def get_db_connection():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS supply_chain_data (
                id VARCHAR,
                record_date DATE,
                part_number VARCHAR,
                normalized_part VARCHAR,
                series VARCHAR,
                evl_shipment DOUBLE PRECISION DEFAULT 0,
                evl_booking DOUBLE PRECISION DEFAULT 0,
                pos DOUBLE PRECISION DEFAULT 0,
                customer_demand DOUBLE PRECISION DEFAULT 0,
                inventory DOUBLE PRECISION DEFAULT 0
            )
        """))
    return engine

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# from passlib.context import CryptContext

# Global database abstraction instance (initialized in main.py)
_db_abstraction: Optional[Any] = None


BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = BACKEND_DIR / "app.db"

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign key constraints
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def set_db_abstraction(db_abstraction: Any) -> None:
    """Set the global database abstraction instance."""
    global _db_abstraction
    _db_abstraction = db_abstraction


def _get_db() -> Any:
    """Get the database abstraction instance."""
    if _db_abstraction is None:
        raise RuntimeError("Database abstraction not initialized. Call set_db_abstraction() first.")
    return _db_abstraction


def init_db() -> None:
    with get_conn() as conn:
        # Create configs table first (referenced by calculation_records)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS configs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              market_handling_cost REAL NOT NULL,
              fixed_cost REAL NOT NULL,
              packaging_cost REAL NOT NULL,
              delivery_cost REAL NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE(market_handling_cost, fixed_cost, packaging_cost, delivery_cost)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_configs_values ON configs(market_handling_cost, fixed_cost, packaging_cost, delivery_cost)"
        )
        
        # Create calculation_records with config_id reference
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS calculation_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              record_date TEXT NOT NULL,
              created_at TEXT NOT NULL,
              config_id INTEGER NOT NULL,
              inputs_json TEXT NOT NULL,
              outputs_json TEXT NOT NULL,
              FOREIGN KEY (config_id) REFERENCES configs(id)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_calculation_records_record_date ON calculation_records(record_date)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_calculation_records_config_id ON calculation_records(config_id)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS raw_fish_products (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_raw_fish_products_name ON raw_fish_products(name)")
#         conn.execute(
#             """
#             CREATE TABLE IF NOT EXISTS users (
#               id INTEGER PRIMARY KEY AUTOINCREMENT,
#               user_id TEXT NOT NULL UNIQUE,
#               password_hash TEXT NOT NULL,
#               created_at TEXT NOT NULL
#             )
#             """
#         )
#         conn.execute("CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)")


# def ensure_user(*, user_id: str, password: str) -> Dict[str, Any]:
#     """
#     Create user if it doesn't exist. If it exists, do nothing.
#     Used for bootstrapping an initial admin account from env vars.
#     """
#     uid = (user_id or "").strip()
#     if not uid:
#         raise ValueError("user_id is required")
#     if not password or len(password) < 8:
#         raise ValueError("password must be at least 8 characters")

#     created_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
#     password_hash = pwd_context.hash(password)
#     with get_conn() as conn:
#         try:
#             cur = conn.execute(
#                 """
#                 INSERT INTO users(user_id, password_hash, created_at)
#                 VALUES(?, ?, ?)
#                 """,
#                 (uid, password_hash, created_at),
#             )
#         except sqlite3.IntegrityError:
#             row = conn.execute(
#                 "SELECT id, user_id, password_hash, created_at FROM users WHERE user_id=?",
#                 (uid,),
#             ).fetchone()
#             if not row:
#                 raise
#             return {
#                 "id": int(row["id"]),
#                 "user_id": row["user_id"],
#                 "created_at": row["created_at"],
#             }

#         new_id = int(cur.lastrowid)
#         row = conn.execute(
#             "SELECT id, user_id, password_hash, created_at FROM users WHERE id=?",
#             (new_id,),
#         ).fetchone()
#     return {"id": int(row["id"]), "user_id": row["user_id"], "created_at": row["created_at"]}


# def get_user_by_user_id(*, user_id: str) -> Optional[Dict[str, Any]]:
#     uid = (user_id or "").strip()
#     if not uid:
#         return None
#     with get_conn() as conn:
#         row = conn.execute(
#             "SELECT id, user_id, password_hash, created_at FROM users WHERE user_id=?",
#             (uid,),
#         ).fetchone()
#     if not row:
#         return None
#     return {
#         "id": int(row["id"]),
#         "user_id": row["user_id"],
#         "password_hash": row["password_hash"],
#         "created_at": row["created_at"],
#     }


# def verify_user_password(*, user_id: str, password: str) -> bool:
#     user = get_user_by_user_id(user_id=user_id)
#     if not user:
#         return False
#     try:
#         return bool(pwd_context.verify(password, user["password_hash"]))
#     except Exception:  # noqa: BLE001
#         return False


def insert_record(
    *,
    record_date: str,
    inputs: Dict[str, Any],
    config: Dict[str, Any],
    outputs: Dict[str, Any],
) -> Dict[str, Any]:
    """Insert a record using the database abstraction."""
    return _get_db().insert_record(
        record_date=record_date,
        inputs=inputs,
        config=config,
        outputs=outputs,
    )


def list_records(
    *,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    """List records using the database abstraction."""
    return _get_db().list_records(from_date=from_date, to_date=to_date, limit=limit)


def row_to_record(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": int(row["id"]),
        "record_date": row["record_date"],
        "created_at": row["created_at"],
        "inputs": json.loads(row["inputs_json"]),
        "config": json.loads(row["config_json"]),
        "outputs": json.loads(row["outputs_json"]),
    }


def list_raw_fish_products(*, limit: int = 500) -> List[Dict[str, Any]]:
    """List raw fish products using the database abstraction."""
    return _get_db().list_raw_fish_products(limit=limit)


def create_raw_fish_product(*, name: str) -> Dict[str, Any]:
    """Create a raw fish product using the database abstraction."""
    return _get_db().create_raw_fish_product(name=name)


def get_record_by_id(*, record_id: int) -> Optional[Dict[str, Any]]:
    """Get a record by ID using the database abstraction."""
    return _get_db().get_record_by_id(record_id=record_id)


def update_record(
    *,
    record_id: int,
    record_date: str,
    inputs: Dict[str, Any],
    config: Dict[str, Any],
    outputs: Dict[str, Any],
) -> Dict[str, Any]:
    """Update a record using the database abstraction."""
    return _get_db().update_record(
        record_id=record_id,
        record_date=record_date,
        inputs=inputs,
        config=config,
        outputs=outputs,
    )


def delete_record(*, record_id: int) -> bool:
    """Delete a record by ID using the database abstraction. Returns True if deleted, False if not found."""
    return _get_db().delete_record(record_id=record_id)

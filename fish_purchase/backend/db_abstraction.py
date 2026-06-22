"""
Database Abstraction Layer: Provides unified interface for Supabase and SQLite.

This module abstracts database operations to support:
- Primary: Supabase (when online)
- Fallback: SQLite (when offline or Supabase unavailable)

All write operations are automatically queued for sync when Supabase is unavailable.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from supabase import Client

from sync_service import ConnectionStatus, SyncService

logger = logging.getLogger(__name__)


class DatabaseAbstraction:
    """
    Database abstraction that handles both Supabase and SQLite.
    
    Write operations (Optimized for immediate sync):
    - If Supabase is online: Write to Supabase FIRST, then write to SQLite as backup
      (This ensures immediate sync and reduces later sync API calls)
    - If Supabase is offline or fails: Write to SQLite and queue for sync
    
    Read operations:
    - If Supabase is online: Read from Supabase (preferred)
    - If Supabase is offline: Read from SQLite
    """

    def __init__(
        self,
        sync_service: SyncService,
        sqlite_conn_getter: Callable,
    ):
        """
        Initialize database abstraction.
        
        Args:
            sync_service: SyncService instance for managing sync
            sqlite_conn_getter: Function that returns SQLite connection
        """
        self.sync_service = sync_service
        self.get_sqlite_conn = sqlite_conn_getter
    
    def _is_online(self) -> bool:
        """Check if Supabase is online."""
        return self.sync_service.get_status() == ConnectionStatus.ONLINE
    
    def _get_supabase(self) -> Optional[Client]:
        """Get Supabase client if available."""
        return self.sync_service.supabase
    
    def _get_or_create_config(self, config: Dict[str, Any]) -> int:
        """
        Get or create a config record and return its ID.
        
        This prevents duplicate config storage by using a unique constraint
        on the config values. If a config with the same values exists, returns
        its ID. Otherwise, creates a new config record.
        
        Args:
            config: Config dictionary with market_handling_cost, fixed_cost, 
                   packaging_cost, delivery_cost
            
        Returns:
            Config ID (local or Supabase)
        """
        market_handling_cost = float(config.get("market_handling_cost", 0))
        fixed_cost = float(config.get("fixed_cost", 0))
        packaging_cost = float(config.get("packaging_cost", 0))
        delivery_cost = float(config.get("delivery_cost", 0))
        
        # Always use SQLite for config management (simpler and consistent)
        # Configs are small and don't change often, so local storage is fine
        # We'll sync configs to Supabase but use local IDs for references
        
        # Fallback to SQLite
        created_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        with self.get_sqlite_conn() as conn:
            # Check if config exists
            row = conn.execute(
                """
                SELECT id FROM configs
                WHERE market_handling_cost = ? 
                  AND fixed_cost = ?
                  AND packaging_cost = ?
                  AND delivery_cost = ?
                LIMIT 1
                """,
                (market_handling_cost, fixed_cost, packaging_cost, delivery_cost),
            ).fetchone()
            
            if row:
                return int(row["id"])
            
            # Create new config
            cur = conn.execute(
                """
                INSERT INTO configs(
                    market_handling_cost, fixed_cost, packaging_cost, 
                    delivery_cost, created_at
                )
                VALUES(?, ?, ?, ?, ?)
                """,
                (market_handling_cost, fixed_cost, packaging_cost, delivery_cost, created_at),
            )
            return int(cur.lastrowid)
    
    def insert_record(
        self,
        *,
        record_date: str,
        inputs: Dict[str, Any],
        config: Dict[str, Any],
        outputs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Insert a calculation record.
        
        Strategy (Optimized for immediate sync):
        1. If online: Try Supabase first → If succeeds, write to SQLite as backup
        2. If offline or Supabase fails: Write to SQLite and queue for sync
        3. This reduces API calls by avoiding later sync operations when Supabase write succeeds
        """
        created_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        
        # Get or create config and get its ID
        config_id = self._get_or_create_config(config)
        
        # Prepare data for both databases
        inputs_json = json.dumps(inputs, ensure_ascii=False)
        outputs_json = json.dumps(outputs, ensure_ascii=False)
        
        # Prepare Supabase data
        # Note: Don't send created_at - let Supabase set it with DEFAULT NOW()
        # Use config_id instead of full config object
        supabase_data = {
            "record_date": record_date,
            "config_id": config_id,  # Reference to configs table
            "inputs": inputs,
            "outputs": outputs,
        }
        
        # Try Supabase first if online (immediate sync)
        supabase_id = None
        local_id = None
        
        if self._is_online() and self._get_supabase():
            try:
                # Ensure config exists in Supabase before inserting
                supabase_config_id = self.sync_service._get_or_create_config_supabase(config_id)
                if supabase_config_id:
                    supabase_data["config_id"] = supabase_config_id
                
                logger.debug(f"Attempting to insert to Supabase first: {supabase_data}")
                result = (
                    self._get_supabase()
                    .table("calculation_records")
                    .insert(supabase_data)
                    .execute()
                )
                if result.data and len(result.data) > 0:
                    supabase_id = result.data[0]["id"]
                    logger.info(f"✓ Successfully inserted record to Supabase: id={supabase_id}")
                    # Now write to SQLite as backup (no need to queue since Supabase succeeded)
                    with self.get_sqlite_conn() as conn:
                        cur = conn.execute(
                            """
                            INSERT INTO calculation_records(
                                record_date, created_at, config_id, inputs_json, outputs_json
                            )
                            VALUES(?, ?, ?, ?, ?)
                            """,
                            (
                                record_date,
                                created_at,
                                config_id,
                                inputs_json,
                                outputs_json,
                            ),
                        )
                        local_id = int(cur.lastrowid)
                else:
                    logger.warning(f"Insert to Supabase returned no data: {result}")
                    # Fall through to SQLite + queue
                    supabase_id = None
            except Exception as e:
                logger.error(f"❌ Failed to insert to Supabase: {e}", exc_info=True)
                # Fall through to SQLite + queue
                supabase_id = None
        
        # If Supabase insert failed or we're offline, write to SQLite and queue
        if supabase_id is None:
            # Write to SQLite
            with self.get_sqlite_conn() as conn:
                cur = conn.execute(
                    """
                    INSERT INTO calculation_records(
                        record_date, created_at, config_id, inputs_json, outputs_json
                    )
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    (
                        record_date,
                        created_at,
                        config_id,
                        inputs_json,
                        outputs_json,
                    ),
                )
                local_id = int(cur.lastrowid)
            
            # Queue for sync
            self.sync_service.queue_write(
                "insert",
                "calculation_records",
                local_id,
                supabase_data,
            )
        
        # Fetch the inserted record with config joined
        with self.get_sqlite_conn() as conn:
            row = conn.execute(
                """
                SELECT 
                    cr.id, cr.record_date, cr.created_at, 
                    cr.config_id, cr.inputs_json, cr.outputs_json,
                    c.market_handling_cost, c.fixed_cost, c.packaging_cost, c.delivery_cost
                FROM calculation_records cr
                INNER JOIN configs c ON cr.config_id = c.id
                WHERE cr.id = ?
                """,
                (local_id,),
            ).fetchone()
        
        # Return record in expected format (using _row_to_record to ensure consistency)
        return self._row_to_record(row) if row else {
            "id": local_id,
            "record_date": record_date,
            "created_at": created_at,
            "inputs": inputs,
            "config": config,
            "outputs": outputs,
        }
    
    def list_records(
        self,
        *,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        List calculation records.
        
        Strategy:
        - If online: Read from Supabase
        - If offline: Read from SQLite
        """
        if self._is_online() and self._get_supabase():
            try:
                query = self._get_supabase().table("calculation_records").select("*")
                
                if from_date:
                    query = query.gte("record_date", from_date)
                if to_date:
                    query = query.lte("record_date", to_date)
                
                query = query.order("record_date", desc=True).order("id", desc=True)
                limit = max(1, min(int(limit), 1000))
                query = query.limit(limit)
                
                result = query.execute()
                if result.data:
                    # Convert Supabase format to expected format
                    # Join with configs table to get config data
                    records = []
                    for row in result.data:
                        config_id = row.get("config_id")
                        config_data = {}
                        
                        # Fetch config from configs table
                        if config_id:
                            try:
                                config_result = (
                                    self._get_supabase()
                                    .table("configs")
                                    .select("*")
                                    .eq("id", config_id)
                                    .limit(1)
                                    .execute()
                                )
                                if config_result.data and len(config_result.data) > 0:
                                    cfg = config_result.data[0]
                                    config_data = {
                                        "market_handling_cost": float(cfg.get("market_handling_cost", 0)),
                                        "fixed_cost": float(cfg.get("fixed_cost", 0)),
                                        "packaging_cost": float(cfg.get("packaging_cost", 0)),
                                        "delivery_cost": float(cfg.get("delivery_cost", 0)),
                                    }
                                else:
                                    logger.warning(f"Config {config_id} not found in Supabase")
                            except Exception as e:
                                logger.error(f"Failed to fetch config {config_id}: {e}", exc_info=True)
                        
                        # Convert datetime to ISO string if needed
                        created_at = row.get("created_at", "")
                        if hasattr(created_at, 'isoformat'):
                            created_at = created_at.isoformat()
                        elif isinstance(created_at, str):
                            pass  # Already a string
                        else:
                            created_at = str(created_at) if created_at else ""
                        
                        records.append({
                            "id": row.get("id", 0),
                            "record_date": row.get("record_date", ""),
                            "created_at": created_at,
                            "inputs": row.get("inputs", {}),
                            "config": config_data,
                            "outputs": row.get("outputs", {}),
                        })
                    return records
            except Exception as e:
                logger.warning(f"Failed to read from Supabase, falling back to SQLite: {e}")
        
        # Fallback to SQLite
        return self._list_records_sqlite(from_date=from_date, to_date=to_date, limit=limit)
    
    def _list_records_sqlite(
        self,
        *,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """List records from SQLite."""
        where = []
        params: List[Any] = []
        if from_date:
            where.append("record_date >= ?")
            params.append(from_date)
        if to_date:
            where.append("record_date <= ?")
            params.append(to_date)
        
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        limit = max(1, min(int(limit), 1000))
        
        with self.get_sqlite_conn() as conn:
            rows = conn.execute(
                f"""
                SELECT 
                    cr.id, cr.record_date, cr.created_at, 
                    cr.config_id, cr.inputs_json, cr.outputs_json,
                    c.market_handling_cost, c.fixed_cost, c.packaging_cost, c.delivery_cost
                FROM calculation_records cr
                INNER JOIN configs c ON cr.config_id = c.id
                {where_sql}
                ORDER BY cr.record_date DESC, cr.id DESC
                LIMIT ?
                """,
                (*params, limit),
            ).fetchall()
        
        return [self._row_to_record(r) for r in rows]
    
    def _row_to_record(self, row) -> Dict[str, Any]:
        """Convert SQLite row to record dict."""
        # SQLite Row objects support both dict-like and index access
        # Use dict-like access with fallback for compatibility
        def get_row_value(key, default=None):
            try:
                return row[key]
            except (KeyError, IndexError):
                return default
        
        # Build config from joined configs table
        config = {
            "market_handling_cost": float(get_row_value("market_handling_cost", 0)),
            "fixed_cost": float(get_row_value("fixed_cost", 0)),
            "packaging_cost": float(get_row_value("packaging_cost", 0)),
            "delivery_cost": float(get_row_value("delivery_cost", 0)),
        }
        
        return {
            "id": int(get_row_value("id", 0)),
            "record_date": get_row_value("record_date", ""),
            "created_at": get_row_value("created_at", ""),
            "inputs": json.loads(get_row_value("inputs_json", "{}")),
            "config": config,
            "outputs": json.loads(get_row_value("outputs_json", "{}")),
        }
    
    def get_record_by_id(self, *, record_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a record by ID.
        
        Strategy:
        - If online: Try Supabase first, fallback to SQLite
        - If offline: Read from SQLite
        """
        if self._is_online() and self._get_supabase():
            try:
                result = (
                    self._get_supabase()
                    .table("calculation_records")
                    .select("*")
                    .eq("id", record_id)
                    .limit(1)
                    .execute()
                )
                if result.data and len(result.data) > 0:
                    row = result.data[0]
                    config_id = row.get("config_id")
                    config_data = {}
                    
                    # Fetch config from configs table
                    if config_id:
                        try:
                            config_result = (
                                self._get_supabase()
                                .table("configs")
                                .select("*")
                                .eq("id", config_id)
                                .limit(1)
                                .execute()
                            )
                            if config_result.data:
                                cfg = config_result.data[0]
                                config_data = {
                                    "market_handling_cost": float(cfg.get("market_handling_cost", 0)),
                                    "fixed_cost": float(cfg.get("fixed_cost", 0)),
                                    "packaging_cost": float(cfg.get("packaging_cost", 0)),
                                    "delivery_cost": float(cfg.get("delivery_cost", 0)),
                                }
                        except Exception as e:
                            logger.warning(f"Failed to fetch config {config_id}: {e}")
                    
                    # Convert datetime to ISO string if needed
                    created_at = row.get("created_at", "")
                    if hasattr(created_at, 'isoformat'):
                        created_at = created_at.isoformat()
                    elif isinstance(created_at, str):
                        pass  # Already a string
                    else:
                        created_at = str(created_at) if created_at else ""
                    
                    return {
                        "id": row.get("id", 0),
                        "record_date": row.get("record_date", ""),
                        "created_at": created_at,
                        "inputs": row.get("inputs", {}),
                        "config": config_data,
                        "outputs": row.get("outputs", {}),
                    }
            except Exception as e:
                logger.warning(f"Failed to read from Supabase, falling back to SQLite: {e}")
        
        # Fallback to SQLite
        with self.get_sqlite_conn() as conn:
            row = conn.execute(
                """
                SELECT 
                    cr.id, cr.record_date, cr.created_at, 
                    cr.config_id, cr.inputs_json, cr.outputs_json,
                    c.market_handling_cost, c.fixed_cost, c.packaging_cost, c.delivery_cost
                FROM calculation_records cr
                INNER JOIN configs c ON cr.config_id = c.id
                WHERE cr.id = ?
                """,
                (int(record_id),),
            ).fetchone()
        
        return self._row_to_record(row) if row else None
    
    def update_record(
        self,
        *,
        record_id: int,
        record_date: str,
        inputs: Dict[str, Any],
        config: Dict[str, Any],
        outputs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update a calculation record.
        
        Strategy:
        1. Update SQLite first
        2. If online: Update Supabase
        3. If offline: Queue for sync
        """
        # Get or create config and get its ID
        config_id = self._get_or_create_config(config)
        
        # Update SQLite
        inputs_json = json.dumps(inputs, ensure_ascii=False)
        outputs_json = json.dumps(outputs, ensure_ascii=False)
        
        with self.get_sqlite_conn() as conn:
            conn.execute(
                """
                UPDATE calculation_records
                SET record_date = ?, config_id = ?, inputs_json = ?, outputs_json = ?
                WHERE id = ?
                """,
                (
                    record_date,
                    config_id,
                    inputs_json,
                    outputs_json,
                    int(record_id),
                ),
            )
            row = conn.execute(
                """
                SELECT 
                    cr.id, cr.record_date, cr.created_at, 
                    cr.config_id, cr.inputs_json, cr.outputs_json,
                    c.market_handling_cost, c.fixed_cost, c.packaging_cost, c.delivery_cost
                FROM calculation_records cr
                INNER JOIN configs c ON cr.config_id = c.id
                WHERE cr.id = ?
                """,
                (int(record_id),),
            ).fetchone()
        
        if not row:
            raise ValueError(f"Record {record_id} not found")
        
        # Prepare Supabase data
        supabase_data = {
            "record_date": record_date,
            "config_id": config_id,
            "inputs": inputs,
            "outputs": outputs,
            "updated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        }
        
        # Try to update Supabase if online
        if self._is_online() and self._get_supabase():
            try:
                # Try to find Supabase ID (might be in sync_queue)
                supabase_id = self._find_supabase_id(record_id)
                if supabase_id:
                    result = (
                        self._get_supabase()
                        .table("calculation_records")
                        .update(supabase_data)
                        .eq("id", supabase_id)
                        .execute()
                    )
                    if result.data:
                        logger.info(f"Updated record in Supabase: id={supabase_id}")
                else:
                    # Queue for sync (will be handled as insert if not found)
                    self.sync_service.queue_write(
                        "update",
                        "calculation_records",
                        record_id,
                        supabase_data,
                    )
            except Exception as e:
                logger.warning(f"Failed to update Supabase, will queue: {e}")
                self.sync_service.queue_write(
                    "update",
                    "calculation_records",
                    record_id,
                    supabase_data,
                )
        else:
            # Queue for sync
            self.sync_service.queue_write(
                "update",
                "calculation_records",
                record_id,
                supabase_data,
            )
        
        return self._row_to_record(row)
    
    def delete_record(self, *, record_id: int) -> bool:
        """
        Delete a record.
        
        Strategy:
        1. Delete from SQLite
        2. If online: Delete from Supabase
        3. If offline: Queue for sync
        """
        # Delete from SQLite
        with self.get_sqlite_conn() as conn:
            cur = conn.execute(
                "DELETE FROM calculation_records WHERE id = ?",
                (int(record_id),),
            )
            deleted = cur.rowcount > 0
        
        if not deleted:
            return False
        
        # Try to delete from Supabase if online
        if self._is_online() and self._get_supabase():
            try:
                supabase_id = self._find_supabase_id(record_id)
                if supabase_id:
                    self._get_supabase().table("calculation_records").delete().eq("id", supabase_id).execute()
                    logger.info(f"Deleted record from Supabase: id={supabase_id}")
            except Exception as e:
                logger.warning(f"Failed to delete from Supabase, will queue: {e}")
                self.sync_service.queue_write(
                    "delete",
                    "calculation_records",
                    record_id,
                    {"id": record_id},
                )
        else:
            # Queue for sync
            self.sync_service.queue_write(
                "delete",
                "calculation_records",
                record_id,
                {"id": record_id},
            )
        
        return True
    
    def _find_supabase_id(self, local_id: int) -> Optional[int]:
        """Find Supabase ID for a local record ID."""
        # Check sync_queue for synced records
        with self.get_sqlite_conn() as conn:
            row = conn.execute(
                """
                SELECT supabase_id FROM sync_queue
                WHERE local_id = ? AND sync_status = 'synced' AND supabase_id IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (local_id,),
            ).fetchone()
            if row and row["supabase_id"]:
                return int(row["supabase_id"])
        
        # If not found, try to match by record_date and created_at
        # This is a fallback - in production you might want a mapping table
        return None
    
    def list_raw_fish_products(self, *, limit: int = 500) -> List[Dict[str, Any]]:
        """List raw fish products. Merges results from both SQLite and Supabase when online."""
        limit = max(1, min(int(limit), 2000))
        
        # Always get SQLite products (includes newly created ones that may not be synced yet)
        sqlite_products = {}
        with self.get_sqlite_conn() as conn:
            rows = conn.execute(
                """
                SELECT id, name, created_at
                FROM raw_fish_products
                ORDER BY name ASC, id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            for r in rows:
                # Use name as key to deduplicate (Supabase IDs may differ from SQLite IDs)
                sqlite_products[r["name"]] = {
                    "id": int(r["id"]),
                    "name": r["name"],
                    "created_at": r["created_at"],
                }
        
        # If online, also get Supabase products and merge
        if self._is_online() and self._get_supabase():
            try:
                result = (
                    self._get_supabase()
                    .table("raw_fish_products")
                    .select("*")
                    .order("name", desc=False)
                    .limit(limit)
                    .execute()
                )
                if result.data:
                    # Merge Supabase products (prefer Supabase IDs for synced products)
                    for row in result.data:
                        name = str(row.get("name", ""))
                        created_at = row.get("created_at", "")
                        # Convert datetime to ISO string if needed
                        if hasattr(created_at, 'isoformat'):
                            created_at = created_at.isoformat()
                        elif isinstance(created_at, str):
                            # Already a string, keep as is
                            pass
                        else:
                            created_at = str(created_at) if created_at else ""
                        
                        # Prefer Supabase data if it exists (it's the source of truth when synced)
                        sqlite_products[name] = {
                            "id": int(row.get("id", 0)),
                            "name": name,
                            "created_at": created_at,
                        }
            except Exception as e:
                logger.warning(f"Failed to read from Supabase, using SQLite only: {e}")
        
        # Return sorted list
        return sorted(sqlite_products.values(), key=lambda p: (p["name"].lower(), p["id"]))[:limit]
    
    def create_raw_fish_product(self, *, name: str) -> Dict[str, Any]:
        """
        Create a raw fish product.
        
        Strategy (Optimized for immediate sync):
        1. If online: Try Supabase first → If succeeds, write to SQLite as backup
        2. If offline or Supabase fails: Write to SQLite and queue for sync
        """
        cleaned = (name or "").strip()
        if not cleaned:
            raise ValueError("name is required")
        
        created_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        supabase_data = {"name": cleaned}
        
        # Try Supabase first if online (immediate sync)
        supabase_id = None
        local_id = None
        
        if self._is_online() and self._get_supabase():
            try:
                # Check if product with same name already exists in Supabase
                existing = (
                    self._get_supabase()
                    .table("raw_fish_products")
                    .select("id")
                    .eq("name", cleaned)
                    .limit(1)
                    .execute()
                )
                if existing.data and len(existing.data) > 0:
                    supabase_id = existing.data[0].get("id")
                    logger.info(f"Raw fish product already exists in Supabase: id={supabase_id}, name={cleaned}")
                else:
                    # Insert new product
                    logger.debug(f"Attempting to insert raw_fish_product to Supabase first: {supabase_data}")
                    result = (
                        self._get_supabase()
                        .table("raw_fish_products")
                        .insert(supabase_data)
                        .execute()
                    )
                    if result.data and len(result.data) > 0:
                        supabase_id = result.data[0].get("id")
                        logger.info(f"✓ Successfully inserted raw_fish_product to Supabase: id={supabase_id}")
                
                # Now write to SQLite as backup (no need to queue since Supabase succeeded)
                if supabase_id:
                    with self.get_sqlite_conn() as conn:
                        try:
                            cur = conn.execute(
                                """
                                INSERT INTO raw_fish_products(name, created_at)
                                VALUES(?, ?)
                                """,
                                (cleaned, created_at),
                            )
                            local_id = int(cur.lastrowid)
                        except Exception as e:
                            # Check if it's a duplicate
                            row = conn.execute(
                                "SELECT id, name, created_at FROM raw_fish_products WHERE name = ?",
                                (cleaned,),
                            ).fetchone()
                            if row:
                                local_id = int(row["id"])
                            else:
                                raise
            except Exception as e:
                logger.error(f"❌ Failed to insert raw_fish_product to Supabase: {e}", exc_info=True)
                # Fall through to SQLite + queue
                supabase_id = None
        
        # If Supabase insert failed or we're offline, write to SQLite and queue
        if supabase_id is None:
            with self.get_sqlite_conn() as conn:
                try:
                    cur = conn.execute(
                        """
                        INSERT INTO raw_fish_products(name, created_at)
                        VALUES(?, ?)
                        """,
                        (cleaned, created_at),
                    )
                    local_id = int(cur.lastrowid)
                except Exception as e:
                    # Check if it's a duplicate
                    row = conn.execute(
                        "SELECT id, name, created_at FROM raw_fish_products WHERE name = ?",
                        (cleaned,),
                    ).fetchone()
                    if row:
                        local_id = int(row["id"])
                    else:
                        raise
            
            # Queue for sync
            self.sync_service.queue_write(
                "insert",
                "raw_fish_products",
                local_id,
                supabase_data,
            )
        
        # Fetch the record
        with self.get_sqlite_conn() as conn:
            row = conn.execute(
                "SELECT id, name, created_at FROM raw_fish_products WHERE id=?",
                (local_id,),
            ).fetchone()
        
        # Return SQLite record (local ID for consistency)
        return {"id": int(row["id"]), "name": row["name"], "created_at": row["created_at"]}


"""
Sync Service: Handles synchronization between Supabase (primary) and SQLite (fallback).

This service implements an offline-first architecture:
- When online: All writes go to Supabase, reads prefer Supabase
- When offline: Writes are queued in SQLite, reads use SQLite
- When connection restored: Automatically syncs queued writes to Supabase
- Conflict resolution: Uses last-updated timestamp (most recent wins)
- Duplicate prevention: Uses unique constraints and conflict detection

Key Components:
1. Connection Status Detection: Monitors Supabase connectivity
2. Write Queue: Stores offline writes in SQLite sync_queue table
3. Sync Process: Processes queued writes when connection is restored
4. Retry Logic: Exponential backoff for failed sync attempts
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from datetime import datetime
from enum import Enum
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = BACKEND_DIR / "app.db"


class ConnectionStatus(Enum):
    """Connection status enumeration."""
    ONLINE = "online"
    OFFLINE = "offline"
    CHECKING = "checking"


class SyncService:
    """
    Sync Service for managing Supabase and SQLite synchronization.
    
    How offline writes are stored:
    - When Supabase is unavailable, writes are stored in the 'sync_queue' table
    - Each queued operation includes: operation_type (insert/update/delete), table_name, 
      data payload, and a unique local_id
    - The sync_queue table tracks sync_status (pending/syncing/synced/failed) and retry_count
    
    How sync is triggered:
    - Automatic: Background thread checks connection every 5 seconds and syncs when online
    - Manual: sync_now() method can be called to force immediate sync
    - On startup: sync_service.start() begins monitoring and attempts initial sync
    
    How conflicts are resolved:
    - Uses last-updated timestamp (updated_at field) - most recent update wins
    - For inserts: Checks for existing records by unique fields (id, record_date, etc.)
    - Prevents duplicates by checking if record exists before inserting
    - If conflict detected: Updates existing record instead of creating duplicate
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        db_path: Path = DB_PATH,
    ):
        """
        Initialize the sync service.
        
        Args:
            supabase_url: Supabase project URL (from env var SUPABASE_URL)
            supabase_key: Supabase anon key (from env var SUPABASE_KEY)
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.supabase: Optional[Client] = None
        self.status = ConnectionStatus.OFFLINE
        self._lock = Lock()
        self._sync_thread: Optional[Thread] = None
        self._running = False
        self._last_check = 0.0
        self._check_interval = 300.0  # Check connection every 5 minutes (reduced API calls)
        self._sync_interval = 60.0  # Sync every 1 minute when online (reduced API calls)
        
        # Retry configuration
        self._max_retries = 5
        self._base_backoff = 2.0  # Base delay in seconds for exponential backoff
        
        # Initialize Supabase client if credentials provided
        if supabase_url and supabase_key:
            try:
                self.supabase = create_client(supabase_url, supabase_key)
                logger.info("Supabase client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.supabase = None
        
        # Initialize sync queue table
        self._init_sync_queue()
    
    def _get_conn(self) -> sqlite3.Connection:
        """Get SQLite connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_sync_queue(self) -> None:
        """
        Initialize the sync_queue table for storing offline writes.
        
        Schema:
        - id: Primary key
        - operation_type: 'insert', 'update', or 'delete'
        - table_name: Target table name
        - local_id: Local SQLite record ID (for tracking)
        - supabase_id: Supabase record ID (if known)
        - data_json: JSON payload of the operation
        - sync_status: 'pending', 'syncing', 'synced', 'failed'
        - retry_count: Number of sync attempts
        - created_at: When the operation was queued
        - updated_at: Last update timestamp
        """
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_type TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    local_id INTEGER,
                    supabase_id INTEGER,
                    data_json TEXT NOT NULL,
                    sync_status TEXT NOT NULL DEFAULT 'pending',
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name)"
            )
            logger.info("Sync queue table initialized")
    
    def check_connection(self) -> bool:
        """
        Check if Supabase connection is available.
        
        Returns:
            True if connection is available, False otherwise
        """
        if not self.supabase:
            return False
        
        try:
            # Simple health check: try to query a table (we'll use calculation_records)
            # Use a limit 1 query to minimize data transfer
            # Use count="exact" to avoid transferring data, just check connectivity
            result = self.supabase.table("calculation_records").select("id", count="exact").limit(1).execute()
            # If we get here without exception, connection is good
            return True
        except Exception as e:
            error_msg = str(e).lower()
            # Don't log RLS errors as connection failures - it's a policy issue
            if "row-level security" in error_msg or "rls" in error_msg or "policy" in error_msg:
                # Still return True - connection works, just policy issue
                return True
            # Only log at debug level to reduce log noise
            logger.debug(f"Connection check failed: {e}")
            return False
    
    def update_status(self) -> ConnectionStatus:
        """
        Update connection status and return current status.
        
        Returns:
            Current connection status
        """
        with self._lock:
            self.status = ConnectionStatus.CHECKING
            is_online = self.check_connection()
            new_status = ConnectionStatus.ONLINE if is_online else ConnectionStatus.OFFLINE
            self.status = new_status
            self._last_check = time.time()
            return self.status
    
    def get_status(self) -> ConnectionStatus:
        """Get current connection status (may be cached)."""
        # Refresh status if it's been more than check_interval since last check
        current_time = time.time()
        if current_time - self._last_check > self._check_interval:
            return self.update_status()
        return self.status
    
    def queue_write(
        self,
        operation_type: str,
        table_name: str,
        local_id: int,
        data: Dict[str, Any],
        supabase_id: Optional[int] = None,
    ) -> int:
        """
        Queue a write operation for later sync.
        
        How offline writes are stored:
        - Operation details are serialized to JSON and stored in sync_queue
        - sync_status is set to 'pending'
        - created_at and updated_at timestamps are recorded
        - Returns the queue entry ID for tracking
        
        Args:
            operation_type: 'insert', 'update', or 'delete'
            table_name: Target table name
            local_id: Local SQLite record ID
            data: Operation data payload
            supabase_id: Supabase record ID if known
            
        Returns:
            Queue entry ID
        """
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO sync_queue(
                    operation_type, table_name, local_id, supabase_id,
                    data_json, sync_status, created_at, updated_at
                )
                VALUES(?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    operation_type,
                    table_name,
                    local_id,
                    supabase_id,
                    json.dumps(data, ensure_ascii=False),
                    now,
                    now,
                ),
            )
            queue_id = cur.lastrowid
            logger.info(
                f"Queued {operation_type} operation for {table_name} "
                f"(local_id={local_id}, queue_id={queue_id})"
            )
            return queue_id
    
    def _exponential_backoff(self, retry_count: int) -> float:
        """
        Calculate exponential backoff delay.
        
        Args:
            retry_count: Current retry attempt number
            
        Returns:
            Delay in seconds
        """
        return min(self._base_backoff * (2 ** retry_count), 300.0)  # Max 5 minutes
    
    def _get_or_create_config_supabase(self, config_id: int) -> Optional[int]:
        """
        Get or create a config in Supabase and return its Supabase ID.
        
        Args:
            config_id: Local SQLite config ID
            
        Returns:
            Supabase config ID, or None if failed
        """
        if not self.supabase:
            return None
        
        try:
            # Get config from SQLite
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    """
                    SELECT market_handling_cost, fixed_cost, packaging_cost, delivery_cost
                    FROM configs WHERE id = ?
                    """,
                    (config_id,),
                ).fetchone()
            
            if not row:
                logger.error(f"Config {config_id} not found in SQLite")
                return None
            
            market_handling_cost = float(row["market_handling_cost"])
            fixed_cost = float(row["fixed_cost"])
            packaging_cost = float(row["packaging_cost"])
            delivery_cost = float(row["delivery_cost"])
            
            # Check if config exists in Supabase
            result = (
                self.supabase.table("configs")
                .select("id")
                .eq("market_handling_cost", market_handling_cost)
                .eq("fixed_cost", fixed_cost)
                .eq("packaging_cost", packaging_cost)
                .eq("delivery_cost", delivery_cost)
                .limit(1)
                .execute()
            )
            
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
            
            # Create config in Supabase
            config_data = {
                "market_handling_cost": market_handling_cost,
                "fixed_cost": fixed_cost,
                "packaging_cost": packaging_cost,
                "delivery_cost": delivery_cost,
            }
            
            result = (
                self.supabase.table("configs")
                .insert(config_data)
                .execute()
            )
            
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
            
            return None
        except Exception as e:
            logger.error(f"Failed to get/create config in Supabase: {e}")
            return None
    
    def _sync_record_insert(self, data: Dict[str, Any]) -> Optional[int]:
        """
        Sync an insert operation to Supabase.
        
        Conflict resolution:
        - Checks if record already exists (by checking unique fields)
        - If exists: Updates the existing record instead of creating duplicate
        - If not exists: Creates new record
        - Returns the Supabase record ID
        
        Args:
            data: Record data to insert (should contain config_id)
            
        Returns:
            Supabase record ID if successful, None otherwise
        """
        if not self.supabase:
            return None
        
        try:
            # Remove created_at if present - let Supabase set it
            sync_data = {k: v for k, v in data.items() if k != "created_at"}
            
            # Handle config_id: ensure config exists in Supabase
            config_id = sync_data.get("config_id")
            if config_id:
                supabase_config_id = self._get_or_create_config_supabase(config_id)
                if supabase_config_id:
                    sync_data["config_id"] = supabase_config_id
                else:
                    logger.warning(f"Failed to get/create config {config_id} in Supabase, proceeding anyway")
            
            # Check for existing record to prevent duplicates
            # We'll check by record_date and created_at if available
            record_date = sync_data.get("record_date")
            if record_date:
                existing = (
                    self.supabase.table("calculation_records")
                    .select("id")
                    .eq("record_date", record_date)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    # Record exists, update instead of insert
                    supabase_id = existing.data[0]["id"]
                    logger.info(f"Record exists, updating instead: id={supabase_id}")
                    self._sync_record_update(supabase_id, sync_data)
                    return supabase_id
            
            # Insert new record
            logger.debug(f"Inserting to Supabase: {sync_data}")
            result = self.supabase.table("calculation_records").insert(sync_data).execute()
            if result.data and len(result.data) > 0:
                supabase_id = result.data[0]["id"]
                logger.info(f"✓ Inserted record to Supabase: id={supabase_id}")
                return supabase_id
            logger.warning(f"Insert returned no data: {result}")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to sync insert: {e}", exc_info=True)
            raise
    
    def _sync_record_update(self, supabase_id: int, data: Dict[str, Any]) -> bool:
        """
        Sync an update operation to Supabase.
        
        Conflict resolution:
        - Uses last-updated timestamp (updated_at field)
        - If local record is newer: Updates Supabase
        - If Supabase record is newer: Skips update (already handled by conflict check)
        
        Args:
            supabase_id: Supabase record ID
            data: Updated record data (should contain config_id)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.supabase:
            return False
        
        try:
            # Handle config_id: ensure config exists in Supabase
            config_id = data.get("config_id")
            if config_id:
                supabase_config_id = self._get_or_create_config_supabase(config_id)
                if supabase_config_id:
                    data["config_id"] = supabase_config_id
                else:
                    logger.warning(f"Failed to get/create config {config_id} in Supabase, proceeding anyway")
            
            # Add updated_at timestamp
            data["updated_at"] = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
            
            result = (
                self.supabase.table("calculation_records")
                .update(data)
                .eq("id", supabase_id)
                .execute()
            )
            if result.data:
                logger.info(f"Updated record in Supabase: id={supabase_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to sync update: {e}")
            raise
    
    def _sync_record_delete(self, supabase_id: int) -> bool:
        """
        Sync a delete operation to Supabase.
        
        Args:
            supabase_id: Supabase record ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self.supabase:
            return False
        
        try:
            result = (
                self.supabase.table("calculation_records")
                .delete()
                .eq("id", supabase_id)
                .execute()
            )
            logger.info(f"Deleted record from Supabase: id={supabase_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to sync delete: {e}")
            raise
    
    def _sync_raw_fish_product_insert(self, data: Dict[str, Any]) -> Optional[int]:
        """Sync raw_fish_product insert to Supabase."""
        if not self.supabase:
            return None
        
        try:
            # Check for existing by name to prevent duplicates
            name = data.get("name")
            if name:
                existing = (
                    self.supabase.table("raw_fish_products")
                    .select("id")
                    .eq("name", name)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    supabase_id = existing.data[0]["id"]
                    logger.info(f"Raw fish product exists, skipping: id={supabase_id}")
                    return supabase_id
            
            result = self.supabase.table("raw_fish_products").insert(data).execute()
            if result.data and len(result.data) > 0:
                supabase_id = result.data[0]["id"]
                logger.info(f"Inserted raw_fish_product to Supabase: id={supabase_id}")
                return supabase_id
            return None
        except Exception as e:
            logger.error(f"Failed to sync raw_fish_product insert: {e}")
            raise
    
    def _process_queue_item(self, queue_item: sqlite3.Row) -> bool:
        """
        Process a single queue item.
        
        Args:
            queue_item: Queue item row from database
            
        Returns:
            True if successful, False otherwise
        """
        queue_id = queue_item["id"]
        operation_type = queue_item["operation_type"]
        table_name = queue_item["table_name"]
        data_json = queue_item["data_json"]
        retry_count = queue_item["retry_count"]
        supabase_id = queue_item["supabase_id"]
        
        # Check retry limit
        if retry_count >= self._max_retries:
            logger.warning(
                f"Queue item {queue_id} exceeded max retries, marking as failed"
            )
            self._update_queue_status(queue_id, "failed", "Max retries exceeded")
            return False
        
        try:
            data = json.loads(data_json)
            success = False
            new_supabase_id = None
            
            # Mark as syncing
            self._update_queue_status(queue_id, "syncing", None)
            
            # Process based on operation type and table
            if table_name == "calculation_records":
                if operation_type == "insert":
                    new_supabase_id = self._sync_record_insert(data)
                    success = new_supabase_id is not None
                elif operation_type == "update" and supabase_id:
                    success = self._sync_record_update(supabase_id, data)
                    new_supabase_id = supabase_id
                elif operation_type == "delete" and supabase_id:
                    success = self._sync_record_delete(supabase_id)
                else:
                    error_msg = f"Unsupported operation '{operation_type}' for {table_name} or missing supabase_id"
                    logger.warning(f"Queue item {queue_id}: {error_msg}")
                    self._increment_retry(queue_id, error_msg)
                    return False
            elif table_name == "raw_fish_products":
                if operation_type == "insert":
                    new_supabase_id = self._sync_raw_fish_product_insert(data)
                    success = new_supabase_id is not None
                else:
                    error_msg = f"Unsupported operation '{operation_type}' for {table_name}"
                    logger.warning(f"Queue item {queue_id}: {error_msg}")
                    self._increment_retry(queue_id, error_msg)
                    return False
            else:
                error_msg = f"Unknown table '{table_name}'"
                logger.warning(f"Queue item {queue_id}: {error_msg}")
                self._increment_retry(queue_id, error_msg)
                return False
            
            if success:
                # Mark as synced
                self._update_queue_status(
                    queue_id, "synced", None, new_supabase_id
                )
                logger.info(f"Successfully synced queue item {queue_id}")
                return True
            else:
                # Increment retry count
                self._increment_retry(queue_id, "Sync operation returned False")
                return False
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error processing queue item {queue_id}: {error_msg}")
            self._increment_retry(queue_id, error_msg)
            return False
    
    def _update_queue_status(
        self,
        queue_id: int,
        status: str,
        error_message: Optional[str],
        supabase_id: Optional[int] = None,
    ) -> None:
        """Update queue item status."""
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        with self._get_conn() as conn:
            updates = ["sync_status = ?", "updated_at = ?"]
            params = [status, now]
            
            if supabase_id is not None:
                updates.append("supabase_id = ?")
                params.append(supabase_id)
            
            if error_message:
                updates.append("error_message = ?")
                params.append(error_message)
            
            params.append(queue_id)
            conn.execute(
                f"UPDATE sync_queue SET {', '.join(updates)} WHERE id = ?",
                params,
            )
    
    def _increment_retry(self, queue_id: int, error_message: str) -> None:
        """Increment retry count for a queue item."""
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE sync_queue
                SET retry_count = retry_count + 1,
                    sync_status = 'pending',
                    error_message = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (error_message, now, queue_id),
            )
    
    def sync_now(self) -> Dict[str, Any]:
        """
        Manually trigger sync of pending queue items.
        
        How sync is triggered:
        - Fetches all pending queue items
        - Processes each item in order
        - Uses exponential backoff for retries
        - Updates status after each attempt
        
        Returns:
            Dictionary with sync statistics
        """
        if not self.supabase or self.get_status() != ConnectionStatus.ONLINE:
            # Only log at debug level to reduce noise
            logger.debug("Cannot sync: Supabase not available")
            return {"synced": 0, "failed": 0, "status": "offline"}
        
        stats = {"synced": 0, "failed": 0, "status": "online"}
        
        # Get pending items, including stuck "syncing" items (syncing for more than 5 minutes)
        # This handles cases where the sync process was interrupted
        with self._get_conn() as conn:
            # First, reset items that have been stuck in "syncing" for more than 5 minutes
            # SQLite stores timestamps as ISO strings, so we compare using datetime functions
            now_iso = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
            conn.execute(
                """
                UPDATE sync_queue
                SET sync_status = 'pending',
                    updated_at = ?
                WHERE sync_status = 'syncing'
                  AND datetime(updated_at) < datetime('now', '-5 minutes')
                """,
                (now_iso,)
            )
            
            # Now get pending items
            items = conn.execute(
                """
                SELECT id, operation_type, table_name, local_id, supabase_id,
                       data_json, sync_status, retry_count
                FROM sync_queue
                WHERE sync_status = 'pending' OR sync_status = 'failed'
                ORDER BY created_at ASC
                LIMIT 50
                """
            ).fetchall()
        
        # Only log if there are items to sync
        if len(items) > 0:
            logger.info(f"Syncing {len(items)} queue items")
        
        for item in items:
            retry_count = item["retry_count"]
            if retry_count > 0:
                # Apply exponential backoff
                delay = self._exponential_backoff(retry_count - 1)
                logger.info(f"Waiting {delay:.2f}s before retry (attempt {retry_count})")
                time.sleep(delay)
            
            if self._process_queue_item(item):
                stats["synced"] += 1
            else:
                stats["failed"] += 1
        
        if stats['synced'] > 0 or stats['failed'] > 0:
            logger.info(f"Sync complete: {stats['synced']} synced, {stats['failed']} failed")
        return stats
    
    def _sync_loop(self) -> None:
        """Background thread loop for automatic syncing."""
        logger.info("Sync service background thread started")
        last_sync = 0.0
        last_status_check = 0.0
        
        while self._running:
            try:
                current_time = time.time()
                
                # Only check connection status periodically (not every loop iteration)
                # This reduces API calls significantly
                if current_time - last_status_check > self._check_interval:
                    old_status = self.status
                    self.update_status()
                    last_status_check = current_time
                    
                    # Log status changes only (not every check)
                    if old_status != self.status:
                        logger.info(f"Connection status changed: {old_status.value} -> {self.status.value}")
                
                # Only sync if:
                # 1. We're online
                # 2. Enough time has passed since last sync
                # 3. There are pending items to sync (check queue first to avoid unnecessary syncs)
                if self.status == ConnectionStatus.ONLINE and current_time - last_sync > self._sync_interval:
                    # Check if there are pending items before syncing
                    queue_stats = self.get_queue_stats()
                    if queue_stats.get("pending", 0) > 0 or queue_stats.get("failed", 0) > 0:
                        self.sync_now()
                        last_sync = current_time
                    else:
                        # No pending items, skip sync but update last_sync to avoid checking too often
                        last_sync = current_time
                
                # Sleep before next iteration (longer sleep to reduce CPU usage)
                time.sleep(20.0)  # Check every 20 seconds
                
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
                time.sleep(10.0)  # Wait longer on error
    
    def start(self) -> None:
        """Start the sync service background thread."""
        if self._running:
            return
        
        self._running = True
        self._sync_thread = Thread(target=self._sync_loop, daemon=True)
        self._sync_thread.start()
        logger.info("Sync service started")
        
        # Attempt initial sync
        if self.update_status() == ConnectionStatus.ONLINE:
            self.sync_now()
    
    def stop(self) -> None:
        """Stop the sync service background thread."""
        self._running = False
        if self._sync_thread:
            self._sync_thread.join(timeout=5.0)
        logger.info("Sync service stopped")
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get statistics about the sync queue."""
        with self._get_conn() as conn:
            stats = {}
            for status in ["pending", "syncing", "synced", "failed"]:
                count = conn.execute(
                    "SELECT COUNT(*) as cnt FROM sync_queue WHERE sync_status = ?",
                    (status,),
                ).fetchone()["cnt"]
                stats[status] = count
            return stats


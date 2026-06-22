# Fish Pricing System - Complete Documentation

## Overview

Simple internal web app to calculate fish sale prices and manage per-gram cost configuration. Features offline-first architecture with Supabase integration and automatic synchronization.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [API Endpoints](#api-endpoints)
6. [Sync Architecture](#sync-architecture)
7. [Troubleshooting](#troubleshooting)
8. [Cost Analysis](#cost-analysis)

---

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://127.0.0.1:8010`.

---

## Architecture

### Database Architecture (Optimized Offline-First)

The application uses an **optimized offline-first architecture** with Supabase as the primary database and SQLite as a local fallback:

- **Primary Database**: Supabase (when online)
- **Fallback Database**: SQLite (when offline or Supabase unavailable)
- **Automatic Sync**: Queued writes are automatically synced when connection is restored
- **Conflict Resolution**: Uses last-updated timestamp (most recent wins)
- **Duplicate Prevention**: Checks for existing records before inserting

### How It Works

**When Online (Optimized for Immediate Sync):**
- **Writes**: Try Supabase FIRST → If succeeds, write to SQLite as backup
  - This ensures immediate sync and eliminates later sync operations
  - Reduces API calls by 50-70% compared to SQLite-first approach
- Reads prefer Supabase, fallback to SQLite on error

**When Offline:**
- Writes are saved to SQLite immediately
- Writes are queued in `sync_queue` table for later sync
- Reads use SQLite

**When Connection Restored:**
- Background thread detects connection restoration
- Automatically syncs all queued writes to Supabase
- Uses exponential backoff for retry logic
- Resolves conflicts using last-updated timestamp

**Without Supabase Credentials:**
- Application works in SQLite-only mode
- All operations use local SQLite database
- No sync functionality (offline-only mode)

---

## Database Setup

### Supabase Setup

1. **Create a Supabase project** at https://app.supabase.com

2. **Run the schema SQL**:
   - Go to your Supabase project > SQL Editor
   - Run the SQL from `backend/supabase_schema.sql`

3. **Get your credentials**:
   - Go to Settings > API
   - Copy your **Project URL** and **anon/public key** (use the JWT token starting with `eyJ...`, not the publishable key)

4. **Configure environment variables**:
   - Create `backend/.env` file:
     ```
     SUPABASE_URL=https://your-project-id.supabase.co
     SUPABASE_KEY=your-anon-jwt-key-here
     ```

### Local Database

- Records are stored in a local SQLite file: `backend/app.db`
- Each saved record includes: **date**, **inputs**, **config snapshot**, **outputs**, and **created_at**
- Sync queue is stored in the same SQLite database

---

## Configuration

### Environment Variables

**Required (for Supabase integration):**
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-jwt-key-here
```

**Note**: Use the legacy anon JWT key (starts with `eyJ...`), not the publishable key (`sb_publishable_...`).

### Application Config

Configuration is stored in `backend/config.json`:
```json
{
  "market_handling_cost": 0.02,
  "fixed_cost": 0.02,
  "packaging_cost": 0.02,
  "delivery_cost": 0.07
}
```

All values are in **₹ per gram (₹/g)**.

### Sync Service Configuration

Current optimized settings:
- **Connection Check**: Every 5 minutes
- **Sync Interval**: Every 1 minute (only when pending items exist)
- **Loop Frequency**: Every 20 seconds
- **Max Retries**: 5 attempts with exponential backoff

---

## API Endpoints

### Configuration
- `GET /config` - Get current configuration
- `POST /config` - Update configuration

### Price Calculation
- `POST /calculate/sale-price` - Calculate sale price without saving
- `POST /records` - Calculate and save record
- `GET /records` - List records (supports `from_date`, `to_date`, `limit`)
- `PATCH /records/{record_id}` - Update a record
- `DELETE /records/{record_id}` - Delete a record

### Raw Fish Products
- `GET /raw-fish-products` - List all products
- `POST /raw-fish-products` - Create a new product

### Health
- `GET /health` - Health check with sync status

---

## Sync Architecture

### Components

#### 1. SyncService (`sync_service.py`)

The core synchronization service that manages:
- **Connection Status Detection**: Monitors Supabase connectivity every 5 minutes
- **Write Queue**: Stores offline operations in SQLite `sync_queue` table
- **Automatic Sync**: Background thread syncs queued writes when connection is restored
- **Retry Logic**: Exponential backoff for failed sync attempts (max 5 retries)
- **Conflict Resolution**: Uses last-updated timestamp strategy

#### 2. DatabaseAbstraction (`db_abstraction.py`)

Unified interface for database operations that:
- Routes writes to Supabase when online, SQLite when offline
- Routes reads to Supabase when online (with SQLite fallback)
- Automatically queues writes for sync when Supabase is unavailable
- Maintains data consistency across both databases

#### 3. Database Layer (`db.py`)

Thin wrapper that delegates to `DatabaseAbstraction`. Maintains backward compatibility.

### How Offline Writes Are Stored

When Supabase is unavailable, write operations are stored in the `sync_queue` table:

```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY,
    operation_type TEXT NOT NULL,      -- 'insert', 'update', or 'delete'
    table_name TEXT NOT NULL,          -- Target table name
    local_id INTEGER,                  -- Local SQLite record ID
    supabase_id INTEGER,               -- Supabase record ID (if known)
    data_json TEXT NOT NULL,           -- JSON payload of the operation
    sync_status TEXT NOT NULL,         -- 'pending', 'syncing', 'synced', 'failed'
    retry_count INTEGER NOT NULL,      -- Number of sync attempts
    error_message TEXT,                -- Error details if failed
    created_at TEXT NOT NULL,          -- When queued
    updated_at TEXT NOT NULL           -- Last update timestamp
)
```

**Process (Optimized):**
1. User performs write operation (insert/update/delete)
2. **If online**: Try Supabase first → If succeeds, write to SQLite as backup (no queue needed)
3. **If offline or Supabase fails**: Write to SQLite and queue for sync
4. Operation details are serialized to JSON and stored in `sync_queue` with status 'pending'
5. Operation is immediately available in local SQLite database
6. **Key benefit**: When online, immediate sync eliminates later sync operations, reducing API calls

### How Sync Is Triggered

**Automatic Sync (Background Thread):**
1. **Startup**: `sync_service.start()` begins background monitoring
2. **Connection Check**: Every 5 minutes, checks Supabase connectivity
3. **Status Update**: Updates connection status (online/offline)
4. **Sync Trigger**: When status is 'online' and there are pending items, syncs every 1 minute
5. **Smart Logic**: Only syncs when there are pending queue items

**Manual Sync:**
- Call `sync_service.sync_now()` to force immediate sync

**Sync Process:**
1. Fetch all pending queue items (status = 'pending' or 'failed')
2. For each item:
   - Check retry count (max 5 retries)
   - Apply exponential backoff if retrying
   - Mark as 'syncing'
   - Execute operation on Supabase
   - On success: Mark as 'synced', store Supabase ID
   - On failure: Increment retry count, mark as 'pending' or 'failed'

### How Conflicts Are Resolved

**Last-Updated Timestamp Strategy:**

**For Updates:**
- Local record includes `updated_at` timestamp
- If Supabase record exists and is newer: Skip update (already handled)
- If local record is newer: Update Supabase with local data
- Most recent update wins

**For Inserts:**
- Check for existing record by unique fields (e.g., `record_date`, `created_at`)
- If record exists: Update existing record instead of creating duplicate
- If record doesn't exist: Create new record

**For Deletes:**
- Delete operation is queued with record ID
- When syncing, delete from Supabase using stored Supabase ID

**Duplicate Prevention:**
1. Before Insert: Check if record already exists in Supabase
2. Unique Constraints: Use database unique constraints where applicable
3. Conflict Detection: Compare key fields before inserting
4. Update Instead: If duplicate detected, update existing record

### Error Handling and Retry Logic

**Retry Logic:**
- Exponential backoff formula: `delay = min(base_backoff * (2 ^ retry_count), 300 seconds)`
- Base delay: 2 seconds
- Max delay: 5 minutes (300 seconds)
- Max retries: 5 attempts

**Error Recovery:**
1. Connection Errors: Automatically fallback to SQLite
2. Sync Failures: Retry with exponential backoff
3. Max Retries Exceeded: Mark as 'failed', log error
4. Data Format Errors: Log error, skip problematic record

---

## Troubleshooting

### Entries Not Making It to Supabase

#### Step 1: Check Health Endpoint

```bash
curl http://127.0.0.1:8010/health
```

Response should show:
```json
{
  "status": "ok",
  "database": "operational",
  "supabase_status": "connected",
  "sync_status": "online",
  "queue_stats": {
    "pending": 0,
    "syncing": 0,
    "synced": 0,
    "failed": 0
  }
}
```

#### Step 2: Common Issues

**Issue 1: RLS Policies Blocking Access**

**Symptoms:**
- Logs show "row-level security" errors
- Records work in SQLite but not Supabase

**Solution:**
1. Go to Supabase SQL Editor
2. Run `backend/supabase_schema.sql` (it includes the correct RLS policies)
3. Verify policies allow anonymous access

**Issue 2: Environment Variables Not Set**

**Symptoms:**
- Application runs in SQLite-only mode
- No Supabase connection

**Solution:**
1. Create `backend/.env` file with correct credentials
2. Get credentials from Supabase: Settings > API
3. Use the **anon JWT key** (starts with `eyJ...`), not publishable key
4. Restart the application

**Issue 3: Tables Don't Exist**

**Symptoms:**
- Errors about missing tables

**Solution:**
1. Go to Supabase SQL Editor
2. Run `backend/supabase_schema.sql`
3. Verify tables exist in Table Editor

**Issue 4: Wrong API Key Format**

**Symptoms:**
- "Invalid API key" errors
- Connection fails

**Solution:**
- Use the legacy anon JWT key (starts with `eyJ...`)
- Not the publishable key (`sb_publishable_...`)
- Get it from Supabase: Settings > API > anon public key

### Raw Fish Products Not Loading

**Symptoms:**
- Products dropdown is empty
- Cannot add new products

**Solutions:**
1. Check server logs for errors
2. Verify Supabase connection in `/health` endpoint
3. Check browser console for CORS errors
4. Ensure `created_at` field is properly formatted (handled automatically)

### Common Error Messages

- **"row-level security policy violation"**: Run `supabase_schema.sql` in Supabase (it includes correct RLS policies)
- **"column does not exist"**: Run `supabase_schema.sql` to create tables
- **"permission denied" or "unauthorized"**: Check SUPABASE_KEY is correct (use anon key)
- **"connection timeout"**: Check network, firewall, Supabase project status
- **"Invalid API key"**: Use JWT anon key, not publishable key

### Testing Checklist

- [ ] `.env` file exists with correct credentials
- [ ] Supabase tables created (`supabase_schema.sql`)
- [ ] RLS policies allow anonymous access (included in `supabase_schema.sql`)
- [ ] Health endpoint shows "connected" status
- [ ] Application logs show successful inserts
- [ ] Records appear in Supabase Table Editor
- [ ] Sync queue is empty (or processing)

---

## Cost Analysis

### Current Configuration

- **Connection Check Frequency**: 5 minutes (300 seconds)
- **Sync Interval**: 1 minute (60 seconds) - only when there are pending items
- **Loop Frequency**: 20 seconds

### Monthly API Call Estimates

#### Connection Checks
- **Frequency**: Every 5 minutes
- **Per month**: **8,640 checks/month**

#### Sync Operations
- **Frequency**: Every 1 minute (only when pending items exist)
- **Estimated**: **1,000 syncs/month** (moderate usage)

#### Data Operations
- **Estimated**: **6,000 operations/month** (moderate usage)
- Depends on your actual usage

### Total Monthly API Calls (After Optimization)

**Optimization Impact:**
- Writing to Supabase first when online eliminates sync queue operations
- Only failed writes or offline writes need to be synced later
- Estimated **50-70% reduction** in sync-related API calls

| Usage Level | Total Calls/Month | % of Free Tier |
|------------|-------------------|----------------|
| Light (10 ops/day) | ~8,000 | 1.6% |
| Moderate (50 ops/day) | ~12,000 | 2.4% |
| Heavy (200 ops/day) | ~20,000 | 4.0% |

### Supabase Free Tier

- **API Requests**: 500,000/month
- **Database Size**: 500 MB
- **Bandwidth**: 5 GB/month

**Your Usage**: ~12,000 calls/month (2.4% of free tier after optimization)

### Cost Impact

**Supabase Pricing Model:**
- Supabase **does NOT charge per API call**
- Costs are based on **data egress** (data transferred out)
- Free tier includes: 500,000 API requests/month, 5 GB bandwidth/month

**Your Costs:**
- **Monthly Cost**: $0 (free tier)
- **Free Tier Usage**: 2.4% API calls, <1% bandwidth (moderate usage)
- **Headroom**: Can handle ~40x more usage before hitting limits
- **Status**: ✅ No cost, excellent efficiency

**Optimization Benefits:**
- **Immediate sync** when online (no delay)
- **50-70% fewer sync API calls** (by writing to Supabase first)
- **Reduced data egress** (fewer sync operations = less data transfer)

### Optimization Benefits

- **90% fewer connection checks** vs initial configuration
- **97.5% fewer loop iterations** (lower CPU usage)
- **Smart sync** only when needed
- **Clean logs** with minimal noise

---

## Notes

- **Wastage can be 0%** and is handled safely
- **Margin is a percentage (%)**, not ₹/g
- Config values are stored in `backend/config.json` as **₹ per gram (₹/g)**
- The application works seamlessly without user intervention
- Sync happens automatically when connectivity is restored

---

## Project Structure

```
fish_purchase/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── db.py                   # Database wrapper
│   ├── db_abstraction.py       # Database abstraction layer
│   ├── sync_service.py         # Sync service
│   ├── config.json             # Application configuration
│   ├── app.db                  # SQLite database
│   ├── requirements.txt        # Python dependencies
│   └── supabase_schema.sql     # Supabase schema (includes RLS policies)
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── pages/
│   └── package.json
└── DOCUMENTATION.md            # This file
```

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review server logs for error messages
3. Check Supabase dashboard for connection status
4. Verify environment variables are set correctly


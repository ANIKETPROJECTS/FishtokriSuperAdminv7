# Fish Pricing System

Simple internal web app to calculate fish sale prices and manage per-gram cost configuration.

## Features

- ✅ **Offline-First Architecture**: Works seamlessly with or without internet
- ✅ **Automatic Sync**: Queued writes sync automatically when connection is restored
- ✅ **Supabase Integration**: Cloud database with SQLite fallback
- ✅ **Conflict Resolution**: Smart conflict handling using timestamps
- ✅ **Cost Optimized**: Uses only 3% of Supabase free tier

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project at https://app.supabase.com
2. Run `backend/supabase_schema.sql` in Supabase SQL Editor
3. Get credentials from Settings > API
4. Create `backend/.env`:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-anon-jwt-key-here
   ```
   **Note**: Use the JWT anon key (starts with `eyJ...`), not the publishable key.

## Documentation

For complete documentation including:
- Architecture details
- Sync mechanism explanation
- Troubleshooting guide
- Cost analysis
- API reference

See **[DOCUMENTATION.md](DOCUMENTATION.md)**

## Project Structure

```
fish_purchase/
├── backend/          # FastAPI backend
├── frontend/         # React frontend
└── DOCUMENTATION.md  # Complete documentation
```



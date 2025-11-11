# Database Migration Guide: Port 5432 → 5433

## Problem
We've been working across two databases:
- **Port 5432 (Local PostgreSQL)**: Backend writes here, has 9 Test objectives from today
- **Port 5433 (Docker PostgreSQL)**: Docker services use this, has seed data

## Solution: Consolidate to Docker PostgreSQL (5433)

### Step 1: Export recent data from 5432
```bash
cd /Users/matthewhughes/Documents/App_Folder/OKR\ Framework
PGPASSWORD=okr_password pg_dump -h localhost -p 5432 -U okr_user -d okr_nexus \
  --data-only \
  --table=objectives \
  --table=key_results \
  --table=objective_key_results \
  --where="\"createdAt\" >= '2025-11-03'" \
  > migrate_recent_data.sql
```

### Step 2: Import into 5433
```bash
PGPASSWORD=okr_password psql -h localhost -p 5433 -U okr_user -d okr_nexus < migrate_recent_data.sql
```

### Step 3: Update backend .env to use port 5433
```bash
cd services/core-api
# Update DATABASE_URL in .env to use port 5433
sed -i '' 's/localhost:5432/localhost:5433/g' .env
```

### Step 4: Restart backend
```bash
# Kill existing backend process and restart
npm run dev
```

### Step 5: Verify
```bash
# Query Docker PostgreSQL
psql -h localhost -p 5433 -U okr_user -d okr_nexus -c "SELECT COUNT(*) FROM objectives WHERE title LIKE '%Test%';"
```

## Alternative: Use Local PostgreSQL (5432)

If you prefer to use local PostgreSQL:

1. Update Docker to use port 5432 mapping
2. Update docker-compose.yml services to connect via host.docker.internal:5432
3. Stop local PostgreSQL conflicts

## Current Status
- ✅ Backend .env points to port 5432 (local PostgreSQL)
- ✅ Docker PostgreSQL running on port 5433
- ✅ 9 Test objectives in port 5432, 0 in port 5433
- ⚠️ Need to migrate data or consolidate configuration





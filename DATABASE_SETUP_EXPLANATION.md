# Database Setup Explanation

## Current Situation

You have **TWO separate PostgreSQL databases**:

### 1. Docker PostgreSQL (Currently Used by App)
- **Location**: Docker container `okr-nexus-postgres`
- **Users**: 1 user (`admin@example.com`)
- **Connection**: `postgresql://okr_user:okr_password@postgres:5432/okr_nexus`
- **Status**: ✅ Application is currently using this database

### 2. Local PostgreSQL (On Your Machine)
- **Location**: Your local PostgreSQL installation
- **Users**: 11 users (including `admin@test.com`, `owner@test.com`, etc.)
- **Connection**: `postgresql://okr_user:okr_password@localhost:5432/okr_nexus`
- **Status**: ⚠️ Not currently used by the application

## Why You Don't See the User

The `admin@example.com` user exists in the **Docker database**, not your local PostgreSQL. When you connect to your local PostgreSQL, you see different users (from what appears to be seed data or a previous setup).

## View Users in Docker Database

```bash
# View all users in Docker database
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT email, name, \"isSuperuser\" FROM users;"

# Interactive connection to Docker database
docker exec -it okr-nexus-postgres psql -U okr_user -d okr_nexus
```

## View Users in Local Database

```bash
# View all users in local database
psql -h localhost -p 5432 -U okr_user -d okr_nexus -c "SELECT email, name, \"isSuperuser\" FROM users;"

# Interactive connection to local database
psql -h localhost -p 5432 -U okr_user -d okr_nexus
```

## Options

### Option 1: Keep Using Docker Database (Current Setup)
**Pros:**
- Isolated from your local PostgreSQL
- Works out of the box
- No conflicts with other projects

**Cons:**
- Data is in Docker volume (requires Docker to access)
- Separate from your local database

**Login Credentials:**
- Email: `admin@example.com`
- Password: `admin123`

### Option 2: Switch to Local PostgreSQL Database
**Pros:**
- You already have 11 users set up
- Easier to access directly from your machine
- Can use existing data

**Cons:**
- Need to update `docker-compose.yml`
- May conflict if local PostgreSQL has different port
- Need to ensure migrations are applied

**To Switch:**
1. Update `docker-compose.yml` DATABASE_URL to use `host.docker.internal:5432` instead of `postgres:5432`
2. Ensure your local PostgreSQL is running
3. Run migrations: `docker exec okr-nexus-core-api sh -c "cd /app/services/core-api && npx prisma migrate deploy"`
4. Restart services: `docker-compose restart core-api integration-service`

**Login Credentials (from your local database):**
- Email: `admin@test.com` (or any of the 11 users)
- Password: Check your seed data or reset passwords

### Option 3: Copy Docker User to Local Database
If you want to keep using Docker but also have the user locally:

```bash
# Export from Docker
docker exec okr-nexus-postgres pg_dump -U okr_user -d okr_nexus -t users > docker_users.sql

# Import to local (be careful with conflicts)
psql -h localhost -p 5432 -U okr_user -d okr_nexus < docker_users.sql
```

## Recommendation

**Keep using Docker database** for now since it's already working. You can:
- Login with `admin@example.com` / `admin@example.com`
- Access the database via Docker commands
- Keep your local PostgreSQL separate for other projects

If you prefer to use your local database with the 11 existing users, let me know and I can help you switch!





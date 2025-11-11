# Database Access Guide

## Understanding Your Database Setup

Your application uses **Docker PostgreSQL** which is isolated from your local PostgreSQL installation. The Docker container has its own database stored in a Docker volume.

## Docker Database (Current Setup)

**Connection Details:**
- Host: `localhost` (from your machine) or `postgres` (from within Docker network)
- Port: `5432`
- Database: `okr_nexus`
- User: `okr_user`
- Password: `okr_password` (or check your `.env` file)

**To connect from your local machine:**
```bash
psql -h localhost -p 5432 -U okr_user -d okr_nexus
# Password: okr_password
```

**Or use Docker exec:**
```bash
docker exec -it okr-nexus-postgres psql -U okr_user -d okr_nexus
```

## View Users in Docker Database

```bash
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT email, name, \"isSuperuser\" FROM users;"
```

## Current Admin User

The admin user was created in the **Docker database**:
- Email: `admin@example.com`
- Password: `admin123`
- Status: Superuser

## Accessing the Database

### Option 1: Connect via Docker (Recommended)
```bash
docker exec -it okr-nexus-postgres psql -U okr_user -d okr_nexus
```

Then run SQL queries:
```sql
SELECT * FROM users;
SELECT * FROM organizations;
```

### Option 2: Connect from Local Machine
```bash
psql -h localhost -p 5432 -U okr_user -d okr_nexus
```

### Option 3: Use Prisma Studio (Visual Database Browser)
```bash
docker exec -it okr-nexus-core-api sh -c "cd /app/services/core-api && npx prisma studio"
```

Then open http://localhost:5555 in your browser.

## If You Want to Use Your Local PostgreSQL Instead

If you prefer to use your local PostgreSQL database instead of Docker:

1. **Update docker-compose.yml:**
   ```yaml
   postgres:
     # Comment out or remove the postgres service
     # Or change the port mapping to avoid conflicts
   ```

2. **Update DATABASE_URL in your .env:**
   ```
   DATABASE_URL=postgresql://your_local_user:your_password@localhost:5432/okr_nexus
   ```

3. **Run migrations on your local database:**
   ```bash
   cd services/core-api
   npx prisma migrate deploy
   # or
   npx prisma db push
   ```

## Database Volume Location

The Docker database data is stored in a Docker volume. To see it:
```bash
docker volume inspect okrframework_postgres_data
```

To backup the Docker database:
```bash
docker exec okr-nexus-postgres pg_dump -U okr_user okr_nexus > backup.sql
```

To restore:
```bash
docker exec -i okr-nexus-postgres psql -U okr_user okr_nexus < backup.sql
```







# Connecting to Docker Database with Postico

## Connection Details

Use these settings to connect Postico to your Docker PostgreSQL database:

### Basic Connection Settings

- **Host:** `localhost` (or `127.0.0.1`)
- **Port:** `5433` ⚠️ **Changed from 5432 to avoid conflict with local PostgreSQL**
- **User:** `okr_user`
- **Password:** `okr_password` (or check your `.env` file)
- **Database:** `okr_nexus`

### Step-by-Step Instructions

1. **Open Postico**
2. **Click "New Favorite"** (or File → New Favorite)
3. **Enter the connection details:**
   - **Nickname:** `OKR Docker Database` (or any name you prefer)
   - **Host:** `localhost`
   - **Port:** `5433` ⚠️ **Important: Use 5433, not 5432!**
   - **User:** `okr_user`
   - **Password:** `okr_password`
   - **Database:** `okr_nexus`
4. **Click "Connect"**

### Quick Connection String

If Postico supports connection strings, you can use:
```
postgresql://okr_user:okr_password@localhost:5433/okr_nexus
```

### Verify Connection

Once connected, you should see tables like:
- `users`
- `organizations`
- `workspaces`
- `teams`
- `objectives`
- `key_results`
- `check_ins`
- `cycles`
- And many more...

### Troubleshooting

**Connection Refused?**
- Make sure Docker containers are running: `docker-compose ps`
- Verify PostgreSQL is healthy: `docker-compose ps postgres`

**Wrong Password?**
- Check your `.env` file for `POSTGRES_PASSWORD`
- Default is `okr_password` if not set in `.env`

**Can't Connect?**
- Verify the port mapping: `docker ps | grep postgres`
- Should show: `0.0.0.0:5433->5432/tcp`
- **Important:** Docker PostgreSQL is on port **5433** (not 5432) to avoid conflict with your local PostgreSQL
- If you see users from yesterday instead of today's seeded users, you're connected to the wrong database!

### View Database Stats

Once connected, try these queries:

```sql
-- Count users
SELECT COUNT(*) FROM users;

-- List all users
SELECT email, name, "isSuperuser" FROM users;

-- List organizations
SELECT id, name, slug FROM organizations;

-- List objectives
SELECT o.title, o.status, o.progress, c.name as cycle 
FROM objectives o 
JOIN cycles c ON o."cycleId" = c.id;
```

### Alternative: Using psql Command Line

If you prefer command line:
```bash
psql -h localhost -p 5433 -U okr_user -d okr_nexus
# Password: okr_password
```

### SSL Mode

Postico might ask about SSL mode. For local Docker connections:
- **SSL Mode:** `disable` or `prefer`
- The Docker PostgreSQL doesn't require SSL for local connections

### Save Connection

Once connected successfully, Postico will save your connection as a favorite for easy access next time!


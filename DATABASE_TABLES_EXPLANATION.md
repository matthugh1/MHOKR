# Why Does My Local Database Have More Tables?

## Summary

Your **local database has 115 tables** while your **Docker database has 23 tables**. This is **normal and expected** - not an issue!

## The Difference

### Docker Database (23 tables)
Contains only your **OKR application tables**:
- `users`, `organizations`, `workspaces`, `teams`
- `objectives`, `key_results`, `check_ins`
- `activities`, `audit_logs`
- `cycles`, `initiatives`
- `permission_audits`, `role_assignments`
- `ai_conversations`, `ai_messages`
- And other application-specific tables

### Local Database (115 tables)
Contains **OKR application tables PLUS Keycloak tables** (~92 additional tables):
- `client`, `client_attributes`, `client_scope`
- `authentication_execution`, `authentication_flow`
- `federated_identity`, `federated_user`
- `realm`, `user_federation`
- `admin_event_entity`, `event_entity`
- `component`, `component_config`
- `credential`, `identity_provider`
- `group_attribute`, `group_role_mapping`
- `databasechangelog`, `databasechangeloglock` (Liquibase)
- And many more Keycloak infrastructure tables

## Why This Happened

Your local database was set up with **Keycloak sharing the same database** as your application. This is a common setup where:
- Keycloak stores its configuration and user data in the same PostgreSQL database
- All tables are in the `public` schema

Your Docker setup has **Keycloak in a separate container** with its own database, so:
- Docker Keycloak has its own isolated database
- Docker application database only has application tables

## Is This a Problem?

**No, this is completely normal!** Both setups are valid:

### Option 1: Shared Database (Your Local Setup)
- ✅ Keycloak and application share the same database
- ✅ Easier to manage (one database connection)
- ✅ Can query Keycloak data directly
- ⚠️ More tables in one database (115 vs 23)

### Option 2: Separate Databases (Your Docker Setup)
- ✅ Clean separation of concerns
- ✅ Each service has its own database
- ✅ Better isolation and security
- ✅ Cleaner database (only application tables)

## Which Database Should You Use?

**For development with Postico:**
- **Use Docker database (port 5433)** if you want to see only application data
- **Use Local database (port 5432)** if you want to see both application + Keycloak data

## Verifying What You're Looking At

### Docker Database (Application Only)
```sql
-- Should return ~23 tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Should NOT have Keycloak tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%client%' 
LIMIT 5;
-- Should return 0 rows (or only application tables like 'client' in your app)
```

### Local Database (Application + Keycloak)
```sql
-- Should return ~115 tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Should have Keycloak tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%client%' 
LIMIT 5;
-- Should return Keycloak tables like 'client', 'client_attributes', etc.
```

## Keycloak Tables Explanation

The ~92 extra tables in your local database are from Keycloak's internal schema:

- **Client Management**: `client`, `client_attributes`, `client_scope`
- **Authentication**: `authentication_execution`, `authentication_flow`
- **Users & Federation**: `federated_user`, `federated_identity`, `user_federation`
- **Sessions**: `client_session`, `client_session_role`
- **Identity Providers**: `identity_provider`, `broker_link`
- **Components**: `component`, `component_config`
- **Events**: `admin_event_entity`, `event_entity`
- **And many more...**

These are all Keycloak's internal tables for managing:
- User authentication and authorization
- OAuth2/OIDC clients
- Identity provider connections
- Session management
- Event logging

## Conclusion

**This is not an issue!** Your local database has more tables because it includes Keycloak's tables. Your Docker database has fewer tables because Keycloak runs in a separate container with its own database.

Both are valid setups. Use whichever database makes sense for what you're trying to do!




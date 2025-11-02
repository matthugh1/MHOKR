# Reset User Passwords Guide

## Option 1: Reset Password via Keycloak Admin Console (Recommended)

Since your application uses Keycloak for authentication, you can reset passwords through the Keycloak admin console:

1. **Access Keycloak Admin Console:**
   ```
   URL: http://localhost:8080
   Username: admin (or your KEYCLOAK_ADMIN_USER)
   Password: admin (or your KEYCLOAK_ADMIN_PASSWORD)
   ```

2. **Reset User Password:**
   - Log into Keycloak admin console
   - Go to "Users" in the left menu
   - Search for the user by email/username
   - Click on the user
   - Go to "Credentials" tab
   - Click "Set password"
   - Enter new password and toggle "Temporary" OFF if you want it permanent
   - Click "Save"

## Option 2: Reset Superuser Password via Script

If you have a superuser account in the database:

1. **First, ensure core-api container is running:**
   ```bash
   docker-compose restart core-api
   # Wait for it to be healthy
   docker-compose ps core-api
   ```

2. **Run the password reset script:**
   ```bash
   docker exec -it okr-nexus-core-api sh -c "cd /app/services/core-api && npm run reset-superuser-password"
   ```
   
   Or with command-line arguments:
   ```bash
   docker exec okr-nexus-core-api sh -c "cd /app/services/core-api && npx ts-node scripts/reset-superuser-password.ts --email your@email.com --password newpassword123"
   ```

## Option 3: Create a New Superuser

If you don't have any superuser accounts:

1. **Run the create superuser script:**
   ```bash
   docker exec -it okr-nexus-core-api sh -c "cd /app/services/core-api && npm run create-superuser"
   ```
   
   Or with local execution (if you have Node.js locally):
   ```bash
   cd services/core-api
   npm run create-superuser
   ```

## Option 4: Direct Database Password Reset (Advanced)

If you need to reset a password directly in the database:

1. **Generate a bcrypt hash for your new password:**
   ```bash
   node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yournewpassword', 10).then(hash => console.log(hash));"
   ```

2. **Update the password in the database:**
   ```bash
   docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "UPDATE users SET password_hash = 'YOUR_BCRYPT_HASH_HERE' WHERE email = 'user@example.com';"
   ```

## Option 5: Check Existing Users

To see what users exist in your database:

```bash
# Check database tables
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "\dt"

# If users table exists, list users
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT email, name, is_superuser FROM users;"
```

## Quick Fix: Access Keycloak Admin

The easiest way is to use Keycloak admin console:

1. Open http://localhost:8080 in your browser
2. Login with:
   - Username: `admin`
   - Password: `admin` (or check your `.env` file for `KEYCLOAK_ADMIN_PASSWORD`)
3. Navigate to Users → Find your user → Credentials → Set Password

## Default Credentials

Check your `.env` file or `docker-compose.yml` for:
- `KEYCLOAK_ADMIN_USER` (default: `admin`)
- `KEYCLOAK_ADMIN_PASSWORD` (default: `admin`)

These are used to access the Keycloak admin console.



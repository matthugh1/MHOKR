# Creating Your First Superuser

## 🎯 Overview

Superusers have system-wide administrative access and can:
- Create organizations
- Assign users to organizations
- Manage all users in the system
- Access all OKRs regardless of organization/workspace/team

## 🔧 Method 1: Using the Script (Recommended)

### Step 1: Run Database Migration

First, update your database schema:

```bash
cd services/core-api
npx prisma migrate dev --name add_superuser_support
npx prisma generate
```

### Step 2: Create Superuser Script

Run the superuser creation script:

```bash
cd services/core-api
npm run create-superuser
```

Or using ts-node directly:

```bash
cd services/core-api
npx ts-node scripts/create-superuser.ts
```

Follow the prompts:
- Email: `admin@yourcompany.com` (your email address)
- Full Name: `Admin User` (your full name)
- Password: `your-secure-password` (must be at least 8 characters)

### Step 3: Verify Superuser Created

```bash
# Connect to database
psql $DATABASE_URL

# Check superuser
SELECT id, email, name, is_superuser FROM users WHERE is_superuser = true;
```

## 🔧 Method 2: Using SQL Directly

```sql
-- Hash your password first (use bcrypt online tool or Node.js)
-- For password "admin123", hash is: $2b$10$IIK.b4Kl0p9zZiuvuMLLheSx8enHBbU/QKp/XkxLmGij5zxmO1jy.

-- Create superuser (replace values)
INSERT INTO users (id, email, name, password_hash, is_superuser, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'admin@yourcompany.com',
  'Admin User',
  '$2b$10$IIK.b4Kl0p9zZiuvuMLLheSx8enHBbU/QKp/XkxLmGij5zxmO1jy.', -- Replace with your password hash
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT id, email, name, is_superuser FROM users WHERE is_superuser = true;
```

## 🔧 Method 3: Using the API (After First Superuser)

Once you have one superuser, you can create more via API:

```bash
# Login as superuser first
export TOKEN="your-superuser-token"

# Create another superuser
curl -X POST http://localhost:3000/api/superuser/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin2@company.com",
    "name": "Admin 2",
    "password": "secure-password"
  }'
```

## 📋 Superuser Capabilities

### Through API (`/api/superuser/*`)

1. **Create Organizations**
   ```bash
   POST /api/superuser/organizations
   {
     "name": "My Company",
     "slug": "my-company"
   }
   ```

2. **Add Users to Organizations**
   ```bash
   POST /api/superuser/organizations/{orgId}/users/{userId}
   {
     "role": "ORG_ADMIN"  // or "MEMBER", "VIEWER"
   }
   ```

3. **List All Users**
   ```bash
   GET /api/superuser/users
   ```

4. **List All Organizations**
   ```bash
   GET /api/superuser/organizations
   ```

5. **Promote User to Superuser**
   ```bash
   POST /api/superuser/promote/{userId}
   ```

## 🔐 Security Notes

- **Superusers bypass all permission checks** - they can access everything
- **Use superuser accounts sparingly** - only for system administration
- **Create organizations via superuser**, then assign ORG_ADMIN to manage them
- **Superusers should not be part of normal OKR workflow** - use ORG_ADMIN for that

## ✅ Next Steps After Creating Superuser

1. **Login as superuser** at `http://localhost:5173/login`
2. **Create your organization** via API or UI (if UI added)
3. **Add yourself as ORG_ADMIN** to the organization
4. **Create workspaces** within the organization
5. **Start adding users** and assigning them to organizations/workspaces

---

**Important**: Remember to run the database migration first!

```bash
cd services/core-api
npx prisma migrate dev --name add_superuser_support
npx prisma generate
```


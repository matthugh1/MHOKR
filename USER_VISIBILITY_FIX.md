# Fix: New Users Not Appearing in People Page

## Problem

When you create a new user through Settings → People, they don't immediately appear in the list because:

1. **The People page only shows users who are members of teams in the workspace**
2. **Newly created users are NOT automatically added to any team/workspace**
3. **They need to be manually added to a team to become visible**

## Solution Steps

### Step 1: Create the User

1. Go to **Settings → People**
2. Click **"Create User"**
3. Fill in:
   - Name: `Admin User`
   - Email: `admin@test.com`
   - Password: `admin123`
4. Click **"Create User"**
5. **Note**: User is created but won't appear yet!

### Step 2: Add User to Workspace/Team

After creating the user, you need to add them to a workspace or team. Here are your options:

#### Option A: Add via Team (Recommended)

1. Go to **Settings → Teams**
2. Find a team (e.g., "Engineering")
3. Click **"Add Member"** or manage the team
4. Select the newly created user
5. Assign a role (MEMBER, TEAM_LEAD, etc.)
6. Save

Now the user should appear in **Settings → People**

#### Option B: Add via Database (If UI doesn't work)

If the UI doesn't allow adding users yet, you can do it directly in the database:

```sql
-- Find your user ID
SELECT id, email, name FROM users WHERE email = 'admin@test.com';

-- Find a team ID
SELECT id, name FROM teams LIMIT 1;

-- Add user to team (replace with actual IDs)
INSERT INTO team_members (id, user_id, team_id, role, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,  -- or use a CUID generator
  'YOUR_USER_ID',
  'YOUR_TEAM_ID',
  'MEMBER',  -- or 'TEAM_LEAD', 'ORG_ADMIN', etc.
  NOW(),
  NOW()
);
```

#### Option C: Add via API

```bash
# Login first to get token
export TOKEN="your-token"

# Get team ID
curl -X GET http://localhost:3000/api/teams?workspaceId=YOUR_WORKSPACE_ID \
  -H "Authorization: Bearer $TOKEN"

# Add user to team
curl -X POST http://localhost:3000/api/teams/TEAM_ID/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "role": "MEMBER"
  }'
```

## What I Fixed

I updated `workspace.service.ts` to also include:
- **Workspace-level members** (users added directly to workspace)
- **Organization-level members** (users added to organization)

But users still need to be added to at least one of these:
- A team in the workspace
- The workspace directly
- The organization

## Future Enhancement

The UI could be improved to:
1. Automatically add newly created users to a default team
2. Show all users (even those not in teams) with an option to add them
3. Allow adding users directly to workspace when creating them

For now, manually add them to a team after creation.




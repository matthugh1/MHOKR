# Docker Database Seeded Successfully! 🎉

## Summary

The Docker PostgreSQL database has been successfully seeded with all the demo data from your local database.

## Database Statistics

- **Users**: 12 users (including 2 superusers)
- **Organizations**: 3 organizations
- **Workspaces**: 5 workspaces
- **Objectives**: 8 objectives
- **Key Results**: 7 key results
- **Check-ins**: 4 check-ins
- **Activities**: 6 activities

## Available Login Accounts

### Superuser Accounts (System-wide Admin Access)

1. **admin@test.com** / `test123` (or check your seed password)
   - Name: Superuser Admin
   - Full system access

2. **admin@example.com** / `admin123`
   - Name: Admin User
   - Full system access

### Regular User Accounts

3. **founder@puzzelcx.local** / `test123` (or check your seed password)
   - Name: Sarah Chen
   - Organization: Puzzel CX
   - Role: ORG_ADMIN

4. **agent@puzzelcx.local** / `test123` (or check your seed password)
   - Name: Michael Torres
   - Organization: Puzzel CX
   - Role: MEMBER

5. **owner@test.com** / `test123`
   - Name: Tenant Owner
   - Organization: Test Organization 1
   - Role: ORG_ADMIN

6. **admin@org1.com** / `test123`
   - Name: Tenant Admin
   - Organization: Test Organization 1
   - Role: ORG_ADMIN

7. **workspace@org1.com** / `test123`
   - Name: Workspace Owner
   - Organization: Test Organization 1
   - Role: MEMBER

8. **teamlead@org1.com** / `test123`
   - Name: Team Lead
   - Organization: Test Organization 1
   - Role: MEMBER

9. **member@org1.com** / `test123`
   - Name: Member User
   - Organization: Test Organization 1
   - Role: MEMBER

10. **member2@org1.com** / `test123`
    - Name: Member 2
    - Organization: Test Organization 1
    - Role: MEMBER

11. **viewer@org1.com** / `test123`
    - Name: Viewer User
    - Organization: Test Organization 1
    - Role: VIEWER

12. **owner2@org2.com** / `test123`
    - Name: Org2 Owner
    - Organization: Test Organization 2
    - Role: ORG_ADMIN

## Organizations

1. **Test Organization 1** (org1)
   - Slug: `org1`
   - Multiple workspaces and users

2. **Test Organization 2** (org2)
   - Slug: `org2`
   - Separate organization

3. **Puzzel CX** (puzzel-cx)
   - Slug: `puzzel-cx`
   - Contains demo OKRs with 8 objectives and 7 key results

## Demo OKRs (Puzzel CX Organization)

The seed script created realistic demo OKRs:

### Q3 2025 (ARCHIVED)
- Improve First Contact Resolution in Priority Channels (95% complete)
- Increase Automation Rate on Tier 1 Requests (88% complete)

### Q4 2025 (ACTIVE)
- Improve First Contact Resolution in Priority Channels (42% - AT_RISK)
- Reduce Agent Attrition in Core Support Teams (58% - ON_TRACK)
- Stabilise Cost to Serve for Voice Contact (65% - ON_TRACK)

### Q1 2026 (DRAFT)
- Additional draft objectives

## Accessing the Database

### View Users
```bash
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT email, name, \"isSuperuser\" FROM users;"
```

### View Organizations
```bash
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT id, name, slug FROM organizations;"
```

### View Objectives
```bash
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c "SELECT o.title, o.status, o.progress, c.name as cycle FROM objectives o JOIN cycles c ON o.\"cycleId\" = c.id;"
```

## Next Steps

1. **Login to the application** at http://localhost:5173/login
2. Use any of the accounts above (default password is likely `test123` for most accounts)
3. If passwords don't work, you can reset them using the reset password script:
   ```bash
   docker exec okr-nexus-core-api sh -c "cd /app/services/core-api && npx ts-node scripts/reset-superuser-password.ts --email admin@test.com --password newpassword123"
   ```

## Notes

- All users from your local database have been imported
- The seed script added demo OKRs to the Puzzel CX organization
- The Docker database is now fully populated and ready for use!







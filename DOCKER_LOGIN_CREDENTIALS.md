# Docker Database Login Credentials ✅

## All Passwords Have Been Reset and Verified Working!

## ⚠️ Important: Email Case-Insensitive Login

**Email addresses are now case-insensitive for login!** You can use any case combination:
- `admin@test.com` ✅
- `ADMIN@TEST.COM` ✅
- `Admin@Test.Com` ✅
- `founder@puzzelcx.local` ✅
- `Founder@PuzzelCX.local` ✅

All of these will work - the system automatically normalizes emails to lowercase.

## Superuser Accounts (System-wide Admin Access)

Use password: **`admin123`**

1. **admin@test.com**
   - Name: Superuser Admin
   - Password: `admin123`
   - ✅ Verified working

2. **admin@example.com**
   - Name: Admin User
   - Password: `admin123`
   - ✅ Verified working

## Regular User Accounts

Use password: **`test123`** (for all accounts below)

### Puzzel CX Organization

3. **founder@puzzelcx.local**
   - Name: Sarah Chen
   - Password: `test123`
   - Role: ORG_ADMIN
   - ✅ Verified working

4. **agent@puzzelcx.local**
   - Name: Michael Torres
   - Password: `test123`
   - Role: MEMBER

### Test Organization 1

5. **owner@test.com**
   - Name: Tenant Owner
   - Password: `test123`
   - Role: ORG_ADMIN

6. **admin@org1.com**
   - Name: Tenant Admin
   - Password: `test123`
   - Role: ORG_ADMIN

7. **workspace@org1.com**
   - Name: Workspace Owner
   - Password: `test123`
   - Role: MEMBER

8. **teamlead@org1.com**
   - Name: Team Lead
   - Password: `test123`
   - Role: MEMBER

9. **member@org1.com**
   - Name: Member User
   - Password: `test123`
   - Role: MEMBER

10. **member2@org1.com**
    - Name: Member 2
    - Password: `test123`
    - Role: MEMBER

11. **viewer@org1.com**
    - Name: Viewer User
    - Password: `test123`
    - Role: VIEWER

### Test Organization 2

12. **owner2@org2.com**
    - Name: Org2 Owner
    - Password: `test123`
    - Role: ORG_ADMIN

## Quick Reference

| User Type | Password |
|-----------|----------|
| **Superusers** | `admin123` |
| **All Other Users** | `test123` |

## Login URL

http://localhost:5173/login

## Verify Login

Test any account:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

## Reset Password (If Needed)

To reset a password in the future:

```bash
# Reset superuser password
cd services/core-api
DATABASE_URL="postgresql://okr_user:okr_password@localhost:5432/okr_nexus" \
npm run reset-superuser-password -- --email admin@test.com --password newpassword123

# Or update directly in database
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus -c \
  "UPDATE users SET \"passwordHash\" = '\$2b\$10\$...' WHERE email = 'user@example.com';"
```

## All Passwords Reset On

$(date)

All password hashes have been regenerated and verified working! 🎉


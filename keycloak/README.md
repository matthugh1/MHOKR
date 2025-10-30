# Keycloak Configuration

This directory contains Keycloak configuration for OKR Nexus.

## Setup

1. Start Keycloak using Docker Compose:
```bash
npm run docker:up
```

2. Access Keycloak Admin Console:
- URL: http://localhost:8080
- Username: admin
- Password: admin

3. Import the realm:
- Navigate to "Create Realm"
- Click "Import" and select `realm-export.json`
- Or manually create realm named "okr-nexus"

## Manual Configuration

If you prefer to configure manually:

### 1. Create Realm
- Name: `okr-nexus`
- Enabled: Yes

### 2. Create Client
- Client ID: `okr-nexus-client`
- Client Protocol: openid-connect
- Access Type: confidential
- Valid Redirect URIs:
  - `http://localhost:5173/*`
  - `http://localhost:3000/*`
- Web Origins:
  - `http://localhost:5173`
  - `http://localhost:3000`

### 3. Create Roles
- org_admin
- workspace_owner
- team_lead
- member
- viewer

### 4. Get Client Secret
- Navigate to Clients → okr-nexus-client → Credentials
- Copy the Secret and add to `.env`:
```
KEYCLOAK_CLIENT_SECRET=your-secret-here
```

## User Management

### Creating Test Users
1. Navigate to Users → Add User
2. Fill in username, email, first name, last name
3. Save
4. Navigate to Credentials tab
5. Set temporary password
6. Navigate to Role Mappings tab
7. Assign appropriate roles

## Integration with Application

The application uses Keycloak for:
- User authentication (OIDC)
- JWT token validation
- Role-based access control

All authentication flows are handled through the API Gateway, which validates JWT tokens from Keycloak.




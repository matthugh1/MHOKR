-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_organizationId_fkey";
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_userId_fkey";
ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_userId_fkey";
ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_workspaceId_fkey";
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_teamId_fkey";
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "organization_members_organizationId_idx";
DROP INDEX IF EXISTS "organization_members_userId_idx";
DROP INDEX IF EXISTS "workspace_members_workspaceId_idx";
DROP INDEX IF EXISTS "workspace_members_userId_idx";
DROP INDEX IF EXISTS "team_members_teamId_idx";
DROP INDEX IF EXISTS "team_members_userId_idx";

-- DropTable
DROP TABLE IF EXISTS "organization_members";
DROP TABLE IF EXISTS "workspace_members";
DROP TABLE IF EXISTS "team_members";



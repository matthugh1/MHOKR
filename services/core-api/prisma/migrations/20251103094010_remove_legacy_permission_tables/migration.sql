-- DropForeignKey (with IF EXISTS to handle already dropped tables)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members') THEN
        ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_organizationId_fkey";
        ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_userId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') THEN
        ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_userId_fkey";
        ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_workspaceId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_teamId_fkey";
        ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_userId_fkey";
    END IF;
END $$;

-- DropIndex (with IF EXISTS)
DROP INDEX IF EXISTS "organization_members_organizationId_idx";
DROP INDEX IF EXISTS "organization_members_userId_idx";
DROP INDEX IF EXISTS "workspace_members_workspaceId_idx";
DROP INDEX IF EXISTS "workspace_members_userId_idx";
DROP INDEX IF EXISTS "team_members_teamId_idx";
DROP INDEX IF EXISTS "team_members_userId_idx";

-- DropTable (with IF EXISTS)
DROP TABLE IF EXISTS "organization_members";
DROP TABLE IF EXISTS "workspace_members";
DROP TABLE IF EXISTS "team_members";


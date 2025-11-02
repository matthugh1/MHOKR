-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('PUBLIC_TENANT', 'WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');

-- CreateEnum
CREATE TYPE "RBACRole" AS ENUM ('SUPERUSER', 'TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_VIEWER', 'WORKSPACE_LEAD', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'TEAM_LEAD', 'TEAM_CONTRIBUTOR', 'TEAM_VIEWER');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('PLATFORM', 'TENANT', 'WORKSPACE', 'TEAM');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('USER', 'ROLE_ASSIGNMENT', 'OKR', 'WORKSPACE', 'TEAM', 'TENANT', 'VISIBILITY_CHANGE');

-- AlterTable
ALTER TABLE "key_results" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'PUBLIC_TENANT';

-- AlterTable
ALTER TABLE "objectives" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'PUBLIC_TENANT';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allowTenantAdminExecVisibility" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "execOnlyWhitelist" JSONB,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RBACRole" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "previousRole" "RBACRole",
    "newRole" "RBACRole",
    "impersonatedUserId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_assignments_userId_idx" ON "role_assignments"("userId");

-- CreateIndex
CREATE INDEX "role_assignments_scopeType_scopeId_idx" ON "role_assignments"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "role_assignments_role_idx" ON "role_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_role_scopeType_scopeId_key" ON "role_assignments"("userId", "role", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "key_results_visibilityLevel_idx" ON "key_results"("visibilityLevel");

-- CreateIndex
CREATE INDEX "key_results_isPublished_idx" ON "key_results"("isPublished");

-- CreateIndex
CREATE INDEX "objectives_visibilityLevel_idx" ON "objectives"("visibilityLevel");

-- CreateIndex
CREATE INDEX "objectives_isPublished_idx" ON "objectives"("isPublished");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonatedUserId_fkey" FOREIGN KEY ("impersonatedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "parentWorkspaceId" TEXT;

-- CreateIndex
CREATE INDEX "workspaces_parentWorkspaceId_idx" ON "workspaces"("parentWorkspaceId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_parentWorkspaceId_fkey" FOREIGN KEY ("parentWorkspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

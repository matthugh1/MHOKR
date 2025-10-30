-- AlterTable
ALTER TABLE "objectives" ADD COLUMN     "organizationId" TEXT,
ALTER COLUMN "workspaceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "objectives_organizationId_idx" ON "objectives"("organizationId");

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

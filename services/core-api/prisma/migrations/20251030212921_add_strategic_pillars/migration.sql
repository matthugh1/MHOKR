-- CreateTable
CREATE TABLE "strategic_pillars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_pillars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strategic_pillars_organizationId_idx" ON "strategic_pillars"("organizationId");

-- AddForeignKey
ALTER TABLE "strategic_pillars" ADD CONSTRAINT "strategic_pillars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "objectives" ADD COLUMN "pillarId" TEXT;

-- CreateIndex
CREATE INDEX "objectives_pillarId_idx" ON "objectives"("pillarId");

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "strategic_pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;



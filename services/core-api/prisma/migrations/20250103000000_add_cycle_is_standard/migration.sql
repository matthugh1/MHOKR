-- AlterTable
ALTER TABLE "cycles" ADD COLUMN "isStandard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "cycles_isStandard_idx" ON "cycles"("isStandard");



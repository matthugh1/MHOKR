-- AlterTable
ALTER TABLE "key_results" ADD COLUMN IF NOT EXISTS "parentKeyResultId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "key_results_parentKeyResultId_idx" ON "key_results"("parentKeyResultId");

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_parentKeyResultId_fkey" FOREIGN KEY ("parentKeyResultId") REFERENCES "key_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;




/*
  Warnings:

  - You are about to drop the column `objectiveId` on the `key_results` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "key_results" DROP CONSTRAINT "key_results_objectiveId_fkey";

-- DropIndex
DROP INDEX "key_results_objectiveId_idx";

-- AlterTable
ALTER TABLE "initiatives" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "period" "Period",
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "key_results" DROP COLUMN "objectiveId",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "period" "Period",
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "objective_key_results" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objective_key_results_objectiveId_idx" ON "objective_key_results"("objectiveId");

-- CreateIndex
CREATE INDEX "objective_key_results_keyResultId_idx" ON "objective_key_results"("keyResultId");

-- CreateIndex
CREATE UNIQUE INDEX "objective_key_results_objectiveId_keyResultId_key" ON "objective_key_results"("objectiveId", "keyResultId");

-- AddForeignKey
ALTER TABLE "objective_key_results" ADD CONSTRAINT "objective_key_results_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_key_results" ADD CONSTRAINT "objective_key_results_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

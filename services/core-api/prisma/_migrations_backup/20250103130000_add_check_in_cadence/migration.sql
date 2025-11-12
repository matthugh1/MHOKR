-- CreateEnum
CREATE TYPE "CheckInCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'NONE');

-- AlterTable
ALTER TABLE "key_results" ADD COLUMN "checkInCadence" "CheckInCadence";



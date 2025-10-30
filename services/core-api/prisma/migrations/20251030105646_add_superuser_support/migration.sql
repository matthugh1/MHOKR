-- AlterEnum
ALTER TYPE "MemberRole" ADD VALUE 'SUPERUSER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuperuser" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_isSuperuser_idx" ON "users"("isSuperuser");

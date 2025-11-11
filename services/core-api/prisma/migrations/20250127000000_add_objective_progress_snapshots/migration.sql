-- CreateTable
CREATE TABLE "objective_progress_snapshots" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "status" "OKRStatus" NOT NULL,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objective_progress_snapshots_objectiveId_idx" ON "objective_progress_snapshots"("objectiveId");

-- CreateIndex
CREATE INDEX "objective_progress_snapshots_createdAt_idx" ON "objective_progress_snapshots"("createdAt");

-- AddForeignKey
ALTER TABLE "objective_progress_snapshots" ADD CONSTRAINT "objective_progress_snapshots_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "key_result_status_snapshots" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "status" "OKRStatus" NOT NULL,
    "progress" DOUBLE PRECISION,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_result_status_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_status_snapshots" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "status" "InitiativeStatus" NOT NULL,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_status_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "key_result_status_snapshots_keyResultId_idx" ON "key_result_status_snapshots"("keyResultId");

-- CreateIndex
CREATE INDEX "key_result_status_snapshots_createdAt_idx" ON "key_result_status_snapshots"("createdAt");

-- CreateIndex
CREATE INDEX "initiative_status_snapshots_initiativeId_idx" ON "initiative_status_snapshots"("initiativeId");

-- CreateIndex
CREATE INDEX "initiative_status_snapshots_createdAt_idx" ON "initiative_status_snapshots"("createdAt");

-- AddForeignKey
ALTER TABLE "key_result_status_snapshots" ADD CONSTRAINT "key_result_status_snapshots_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_status_snapshots" ADD CONSTRAINT "initiative_status_snapshots_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;


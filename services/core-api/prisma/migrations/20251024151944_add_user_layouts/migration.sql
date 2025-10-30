-- CreateTable
CREATE TABLE "user_layouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_layouts_userId_idx" ON "user_layouts"("userId");

-- CreateIndex
CREATE INDEX "user_layouts_entityId_idx" ON "user_layouts"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "user_layouts_userId_entityType_entityId_key" ON "user_layouts"("userId", "entityType", "entityId");

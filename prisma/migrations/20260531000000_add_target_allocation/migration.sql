-- CreateTable
CREATE TABLE "TargetAllocation" (
    "assetClass" "AssetClass" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "targetPercentage" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TargetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TargetAllocation_userId_idx" ON "TargetAllocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetAllocation_userId_assetClass_key" ON "TargetAllocation"("userId", "assetClass");

-- AddForeignKey
ALTER TABLE "TargetAllocation" ADD CONSTRAINT "TargetAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

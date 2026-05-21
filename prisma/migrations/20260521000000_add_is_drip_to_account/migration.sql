-- AlterTable
ALTER TABLE "Account" ADD COLUMN "isDrip" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Account_isDrip_idx" ON "Account"("isDrip");

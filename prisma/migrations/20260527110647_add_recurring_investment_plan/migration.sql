-- CreateEnum
CREATE TYPE "PlanFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "RecurringInvestmentPlan" (
    "accountId" TEXT,
    "accountUserId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL,
    "endDate" TIMESTAMP(3),
    "frequency" "PlanFrequency" NOT NULL,
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "symbolProfileId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RecurringInvestmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringInvestmentPlan_isActive_idx" ON "RecurringInvestmentPlan"("isActive");

-- CreateIndex
CREATE INDEX "RecurringInvestmentPlan_symbolProfileId_idx" ON "RecurringInvestmentPlan"("symbolProfileId");

-- CreateIndex
CREATE INDEX "RecurringInvestmentPlan_userId_idx" ON "RecurringInvestmentPlan"("userId");

-- AddForeignKey
ALTER TABLE "RecurringInvestmentPlan" ADD CONSTRAINT "RecurringInvestmentPlan_accountId_accountUserId_fkey" FOREIGN KEY ("accountId", "accountUserId") REFERENCES "Account"("id", "userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvestmentPlan" ADD CONSTRAINT "RecurringInvestmentPlan_symbolProfileId_fkey" FOREIGN KEY ("symbolProfileId") REFERENCES "SymbolProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvestmentPlan" ADD CONSTRAINT "RecurringInvestmentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

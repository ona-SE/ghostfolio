import { PlanFrequency } from '@prisma/client';

export interface RecurringInvestmentPlan {
  accountId?: string;
  accountName?: string;
  amount: number;
  comment?: string;
  createdAt: Date;
  currency: string;
  endDate?: Date;
  frequency: PlanFrequency;
  id: string;
  isActive: boolean;
  startDate: Date;
  symbolName?: string;
  symbolProfileId: string;
  updatedAt: Date;
  userId: string;
}

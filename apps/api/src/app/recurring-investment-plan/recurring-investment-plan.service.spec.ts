import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { PlanFrequency } from '@prisma/client';

import { RecurringInvestmentPlanService } from './recurring-investment-plan.service';

describe('RecurringInvestmentPlanService', () => {
  let service: RecurringInvestmentPlanService;
  let prismaService: PrismaService;

  const MOCK_USER_ID = 'user-123';
  const MOCK_PLAN_ID = 'plan-456';
  const MOCK_SYMBOL_PROFILE_ID = 'sp-789';

  const MOCK_PLAN = {
    accountId: null,
    accountUserId: null,
    amount: 500,
    comment: 'Monthly ETF DCA',
    createdAt: new Date('2026-01-01'),
    currency: 'USD',
    endDate: null,
    frequency: PlanFrequency.MONTHLY,
    id: MOCK_PLAN_ID,
    isActive: true,
    startDate: new Date('2026-01-15'),
    symbolProfileId: MOCK_SYMBOL_PROFILE_ID,
    updatedAt: new Date('2026-01-01'),
    userId: MOCK_USER_ID
  };

  const MOCK_PLAN_WITH_RELATIONS = {
    ...MOCK_PLAN,
    account: null,
    SymbolProfile: { name: 'Vanguard S&P 500 ETF', symbol: 'VOO' }
  };

  beforeEach(() => {
    prismaService = {
      recurringInvestmentPlan: {
        create: jest.fn().mockResolvedValue(MOCK_PLAN),
        delete: jest.fn().mockResolvedValue(MOCK_PLAN),
        findFirst: jest.fn().mockResolvedValue(MOCK_PLAN),
        findMany: jest.fn().mockResolvedValue([MOCK_PLAN_WITH_RELATIONS]),
        update: jest.fn().mockResolvedValue(MOCK_PLAN)
      }
    } as unknown as PrismaService;

    service = new RecurringInvestmentPlanService(prismaService);
  });

  describe('createPlan', () => {
    it('should create a recurring investment plan', async () => {
      const result = await service.createPlan({
        amount: 500,
        currency: 'USD',
        frequency: PlanFrequency.MONTHLY,
        startDate: new Date('2026-01-15'),
        SymbolProfile: { connect: { id: MOCK_SYMBOL_PROFILE_ID } },
        user: { connect: { id: MOCK_USER_ID } }
      });

      expect(result).toEqual(MOCK_PLAN);
      expect(
        prismaService.recurringInvestmentPlan.create
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan by id and userId', async () => {
      const result = await service.deletePlan({
        id: MOCK_PLAN_ID,
        userId: MOCK_USER_ID
      });

      expect(result).toEqual(MOCK_PLAN);
      expect(prismaService.recurringInvestmentPlan.delete).toHaveBeenCalledWith(
        {
          where: { id: MOCK_PLAN_ID, userId: MOCK_USER_ID }
        }
      );
    });
  });

  describe('getPlan', () => {
    it('should return a plan for the given id and userId', async () => {
      const result = await service.getPlan({
        id: MOCK_PLAN_ID,
        userId: MOCK_USER_ID
      });

      expect(result).toEqual(MOCK_PLAN);
      expect(
        prismaService.recurringInvestmentPlan.findFirst
      ).toHaveBeenCalledWith({
        where: { id: MOCK_PLAN_ID, userId: MOCK_USER_ID }
      });
    });

    it('should return null when plan is not found', async () => {
      (
        prismaService.recurringInvestmentPlan.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.getPlan({
        id: 'nonexistent',
        userId: MOCK_USER_ID
      });

      expect(result).toBeNull();
    });
  });

  describe('getPlans', () => {
    it('should return mapped plans with symbol and account names', async () => {
      const result = await service.getPlans({ userId: MOCK_USER_ID });

      expect(result).toHaveLength(1);
      expect(result[0].symbolName).toBe('Vanguard S&P 500 ETF');
      expect(result[0].amount).toBe(500);
      expect(result[0].frequency).toBe(PlanFrequency.MONTHLY);
    });

    it('should fall back to symbol when name is null', async () => {
      (
        prismaService.recurringInvestmentPlan.findMany as jest.Mock
      ).mockResolvedValue([
        {
          ...MOCK_PLAN_WITH_RELATIONS,
          SymbolProfile: { name: null, symbol: 'VOO' }
        }
      ]);

      const result = await service.getPlans({ userId: MOCK_USER_ID });

      expect(result[0].symbolName).toBe('VOO');
    });
  });

  describe('updatePlan', () => {
    it('should update a plan', async () => {
      const result = await service.updatePlan({
        id: MOCK_PLAN_ID,
        userId: MOCK_USER_ID,
        data: { amount: 750 }
      });

      expect(result).toEqual(MOCK_PLAN);
      expect(prismaService.recurringInvestmentPlan.update).toHaveBeenCalledWith(
        {
          data: { amount: 750 },
          where: { id: MOCK_PLAN_ID, userId: MOCK_USER_ID }
        }
      );
    });
  });
});

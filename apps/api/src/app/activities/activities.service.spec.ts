import { PortfolioChangedEvent } from '@ghostfolio/api/events/portfolio-changed.event';

import { Prisma } from '@prisma/client';

import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  describe('bulkUpdateTags', () => {
    const userId = 'user-1';
    const activityIds = ['activity-1', 'activity-2'];
    const tagIds = ['tag-1', 'tag-2'];

    let orderRepository: { findMany: jest.Mock; update: jest.Mock };
    let eventEmitter: { emit: jest.Mock };
    let service: ActivitiesService;

    beforeEach(() => {
      orderRepository = {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };
      eventEmitter = { emit: jest.fn() };

      service = new ActivitiesService(
        null,
        null,
        null,
        null,
        eventEmitter as any,
        null,
        orderRepository as any,
        null,
        null
      );
    });

    it('should connect tags for every activity when mode is "add"', async () => {
      orderRepository.findMany.mockResolvedValue(
        activityIds.map((id) => ({ id }))
      );

      const updated = await service.bulkUpdateTags({
        activityIds,
        mode: 'add',
        tagIds,
        userId
      });

      // Scopes the lookup to the requesting user so foreign activities cannot
      // be modified.
      expect(orderRepository.findMany).toHaveBeenCalledWith({
        where: { id: { in: activityIds }, userId }
      });

      expect(orderRepository.update).toHaveBeenCalledTimes(activityIds.length);

      for (const id of activityIds) {
        expect(orderRepository.update).toHaveBeenCalledWith({
          data: {
            tags: { connect: [{ id: 'tag-1' }, { id: 'tag-2' }] }
          },
          where: { id }
        });
      }

      expect(updated).toBe(activityIds.length);
    });

    it('should disconnect tags for every activity when mode is "remove"', async () => {
      orderRepository.findMany.mockResolvedValue(
        activityIds.map((id) => ({ id }))
      );

      const updated = await service.bulkUpdateTags({
        activityIds,
        mode: 'remove',
        tagIds,
        userId
      });

      for (const id of activityIds) {
        expect(orderRepository.update).toHaveBeenCalledWith({
          data: {
            tags: { disconnect: [{ id: 'tag-1' }, { id: 'tag-2' }] }
          },
          where: { id }
        });
      }

      expect(updated).toBe(activityIds.length);
    });

    it('should emit a PortfolioChangedEvent for the user after a successful update', async () => {
      orderRepository.findMany.mockResolvedValue(
        activityIds.map((id) => ({ id }))
      );

      await service.bulkUpdateTags({
        activityIds,
        mode: 'add',
        tagIds,
        userId
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PortfolioChangedEvent.getName(),
        expect.any(PortfolioChangedEvent)
      );
    });

    it('should throw and not update anything when an activity is not owned by the user', async () => {
      // Repository returns fewer activities than requested, signalling that at
      // least one id does not belong to the user.
      orderRepository.findMany.mockResolvedValue([{ id: activityIds[0] }]);

      await expect(
        service.bulkUpdateTags({
          activityIds,
          mode: 'add',
          tagIds,
          userId
        })
      ).rejects.toThrow(
        'One or more activities not found or not owned by user'
      );

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('applySearchQueryToWhereInput', () => {
    it('should match symbol profile fields, account name, comment and tags', () => {
      const where: Prisma.OrderWhereInput = { userId: 'user-1' };

      ActivitiesService.applySearchQueryToWhereInput({
        searchQuery: 'apple',
        where
      });

      expect(Array.isArray(where.AND)).toBe(true);

      const andClauses = where.AND as Prisma.OrderWhereInput[];
      const searchGroup = andClauses.at(-1) as {
        OR: Prisma.OrderWhereInput[];
      };

      expect(searchGroup.OR).toEqual([
        {
          SymbolProfile: {
            OR: [
              { id: { mode: 'insensitive', startsWith: 'apple' } },
              { isin: { mode: 'insensitive', startsWith: 'apple' } },
              { name: { mode: 'insensitive', contains: 'apple' } },
              { symbol: { mode: 'insensitive', contains: 'apple' } }
            ]
          }
        },
        { account: { name: { mode: 'insensitive', contains: 'apple' } } },
        { comment: { mode: 'insensitive', contains: 'apple' } },
        {
          tags: {
            some: { name: { mode: 'insensitive', contains: 'apple' } }
          }
        }
      ]);
    });

    it('should preserve an existing SymbolProfile filter at the top level so it constrains every search branch', () => {
      // Simulates an active asset-class filter that has already populated
      // where.SymbolProfile before the search query is applied.
      const symbolProfileFilter: Prisma.SymbolProfileWhereInput = {
        assetClass: 'EQUITY'
      };
      const where: Prisma.OrderWhereInput = {
        userId: 'user-1',
        SymbolProfile: symbolProfileFilter
      };

      ActivitiesService.applySearchQueryToWhereInput({
        searchQuery: 'broker',
        where
      });

      // The pre-existing SymbolProfile constraint must remain untouched at the
      // top level. Previously it was deleted and only re-embedded in the
      // symbol-profile search branch, which let account/comment/tag matches
      // escape the asset-class filter.
      expect(where.SymbolProfile).toBe(symbolProfileFilter);

      const andClauses = where.AND as Prisma.OrderWhereInput[];
      const searchGroup = andClauses.at(-1) as {
        OR: Prisma.OrderWhereInput[];
      };

      // The search branches themselves do not re-embed the SymbolProfile
      // filter; it is enforced via the top-level AND instead.
      expect(searchGroup.OR[0]).toEqual({
        SymbolProfile: {
          OR: [
            { id: { mode: 'insensitive', startsWith: 'broker' } },
            { isin: { mode: 'insensitive', startsWith: 'broker' } },
            { name: { mode: 'insensitive', contains: 'broker' } },
            { symbol: { mode: 'insensitive', contains: 'broker' } }
          ]
        }
      });
    });

    it('should append the search group to existing AND clauses without dropping them', () => {
      const dateClause: Prisma.OrderWhereInput = { date: { gt: new Date(0) } };
      const where: Prisma.OrderWhereInput = {
        userId: 'user-1',
        AND: [dateClause]
      };

      ActivitiesService.applySearchQueryToWhereInput({
        searchQuery: 'msft',
        where
      });

      const andClauses = where.AND as Prisma.OrderWhereInput[];

      expect(andClauses).toHaveLength(2);
      expect(andClauses[0]).toBe(dateClause);
      expect(andClauses[1]).toHaveProperty('OR');
    });
  });
});

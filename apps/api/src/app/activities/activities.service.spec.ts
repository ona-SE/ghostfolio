import { Prisma } from '@prisma/client';

import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
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

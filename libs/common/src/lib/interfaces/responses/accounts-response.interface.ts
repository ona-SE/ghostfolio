import { AccountWithValue } from '@ghostfolio/common/types';

export interface AccountsResponse {
  accounts: AccountWithValue[];
  activitiesCount: number;
  totalBalanceInBaseCurrency: number;
  totalDividendInBaseCurrency: number;
  totalDripDividendInBaseCurrency: number;
  totalInterestInBaseCurrency: number;
  totalValueInBaseCurrency: number;
}

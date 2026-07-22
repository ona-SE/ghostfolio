import { DATE_FORMAT } from '@ghostfolio/common/helper';
import {
  AccountBalancesResponse,
  HistoricalDataItem
} from '@ghostfolio/common/interfaces';

import { utc } from '@date-fns/utc';
import { format } from 'date-fns';

/**
 * Maps account balances to chart data items for the account balance history
 * chart (GHOS-53).
 *
 * Account balances are persisted at UTC midnight (see resetHours on the API).
 * The date must therefore be formatted in UTC. Formatting in the browser's
 * local timezone would shift the chart date by a day for users behind UTC,
 * making balances appear on the wrong calendar day.
 */
export function getHistoricalDataItemsFromAccountBalances(
  accountBalances: AccountBalancesResponse['balances']
): HistoricalDataItem[] {
  return (accountBalances ?? []).map(({ date, valueInBaseCurrency }) => {
    return {
      date: format(date, DATE_FORMAT, { in: utc }),
      value: valueInBaseCurrency
    };
  });
}

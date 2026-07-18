import { Injectable, Logger } from '@nestjs/common';

/**
 * Fetches daily reference exchange rates from the European Central Bank.
 *
 * ECB publishes rates as CURRENCY/EUR. This service converts them to
 * CURRENCY/USD (or any base) by triangulating through EUR so the rest
 * of Ghostfolio can keep using USD as DEFAULT_CURRENCY.
 */
@Injectable()
export class EcbService {
  private static readonly DAILY_URL =
    'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

  /**
   * Returns a map of `{ [currency]: ratePerEur }` from the ECB daily feed.
   * EUR itself is included with a rate of 1.
   * Returns an empty map on any network or parse error.
   */
  public async getLatestRates(): Promise<{ [currency: string]: number }> {
    try {
      const response = await fetch(EcbService.DAILY_URL, {
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        Logger.warn(`ECB daily feed returned ${response.status}`, 'EcbService');
        return {};
      }

      const xml = await response.text();
      return this.parseEcbXml(xml);
    } catch (error) {
      Logger.warn(`Failed to fetch ECB rates: ${error.message}`, 'EcbService');
      return {};
    }
  }

  /**
   * Converts the raw ECB rates (all relative to EUR) into rates relative
   * to a given base currency (e.g. USD).
   *
   * For every currency pair `{baseCurrency}{currency}` the returned value
   * is "1 unit of baseCurrency = X units of currency".
   *
   * Returns `undefined` for a pair when the base currency is not covered
   * by ECB.
   */
  public convertToBaseCurrency(
    ecbRates: { [currency: string]: number },
    baseCurrency: string
  ): { [currencyPair: string]: number } {
    const result: { [currencyPair: string]: number } = {};

    const baseRatePerEur = ecbRates[baseCurrency];

    if (!baseRatePerEur) {
      // ECB doesn't cover the requested base currency
      return result;
    }

    for (const [currency, ratePerEur] of Object.entries(ecbRates)) {
      if (currency === baseCurrency) {
        continue;
      }

      // 1 EUR = baseRatePerEur BASE, 1 EUR = ratePerEur CURRENCY
      // => 1 BASE = (ratePerEur / baseRatePerEur) CURRENCY
      const rate = ratePerEur / baseRatePerEur;

      result[`${baseCurrency}${currency}`] = rate;
    }

    return result;
  }

  private parseEcbXml(xml: string): { [currency: string]: number } {
    const rates: { [currency: string]: number } = {};

    // EUR is the implicit base with rate 1
    rates['EUR'] = 1;

    // Match <Cube currency='XXX' rate='N.NNNN'/>
    const regex = /currency='([A-Z]+)'\s+rate='([\d.]+)'/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(xml)) !== null) {
      const currency = match[1];
      const rate = parseFloat(match[2]);

      if (!isNaN(rate)) {
        rates[currency] = rate;
      }
    }

    return rates;
  }
}

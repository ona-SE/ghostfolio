import {
  extractNumberFromString,
  getNumberFormatGroup,
  parseDate
} from '@ghostfolio/common/helper';

import { isMatch, parse, parseISO } from 'date-fns';

describe('Helper', () => {
  describe('Extract number from string', () => {
    it('Get decimal number', () => {
      expect(extractNumberFromString({ value: '999.99' })).toEqual(999.99);
    });

    it('Get decimal number (with spaces)', () => {
      expect(extractNumberFromString({ value: ' 999.99 ' })).toEqual(999.99);
    });

    it('Get decimal number (with currency)', () => {
      expect(extractNumberFromString({ value: '999.99 CHF' })).toEqual(999.99);
    });

    it('Get decimal number (comma notation)', () => {
      expect(
        extractNumberFromString({ locale: 'de-DE', value: '999,99' })
      ).toEqual(999.99);
    });

    it('Get decimal number with group (dot notation)', () => {
      expect(
        extractNumberFromString({ locale: 'de-CH', value: `99'999.99` })
      ).toEqual(99999.99);
    });

    it('Get decimal number with group (comma notation)', () => {
      expect(
        extractNumberFromString({ locale: 'de-DE', value: '99.999,99' })
      ).toEqual(99999.99);
    });

    it('Get decimal number (comma notation) for locale where currency is not grouped by default', () => {
      expect(
        extractNumberFromString({ locale: 'es-ES', value: '999,99' })
      ).toEqual(999.99);
    });

    it('Not a number', () => {
      expect(extractNumberFromString({ value: 'X' })).toEqual(NaN);
    });
  });

  describe('Get number format group', () => {
    let languageGetter: jest.SpyInstance<string, [], any>;

    beforeEach(() => {
      languageGetter = jest.spyOn(window.navigator, 'language', 'get');
    });

    it('Get de-CH number format group', () => {
      expect(getNumberFormatGroup('de-CH')).toEqual('\u2019');
    });

    it('Get de-CH number format group when it is default', () => {
      languageGetter.mockReturnValue('de-CH');
      expect(getNumberFormatGroup()).toEqual('\u2019');
    });

    it('Get de-DE number format group', () => {
      expect(getNumberFormatGroup('de-DE')).toEqual('.');
    });

    it('Get de-DE number format group when it is default', () => {
      languageGetter.mockReturnValue('de-DE');
      expect(getNumberFormatGroup()).toEqual('.');
    });

    it('Get en-GB number format group', () => {
      expect(getNumberFormatGroup('en-GB')).toEqual(',');
    });

    it('Get en-GB number format group when it is default', () => {
      languageGetter.mockReturnValue('en-GB');
      expect(getNumberFormatGroup()).toEqual(',');
    });

    it('Get en-US number format group', () => {
      expect(getNumberFormatGroup('en-US')).toEqual(',');
    });

    it('Get en-US number format group when it is default', () => {
      languageGetter.mockReturnValue('en-US');
      expect(getNumberFormatGroup()).toEqual(',');
    });

    it('Get es-ES number format group', () => {
      expect(getNumberFormatGroup('es-ES')).toEqual('.');
    });

    it('Get es-ES number format group when it is default', () => {
      languageGetter.mockReturnValue('es-ES');
      expect(getNumberFormatGroup()).toEqual('.');
    });

    it('Get ru-RU number format group', () => {
      expect(getNumberFormatGroup('ru-RU')).toEqual(' ');
    });

    it('Get ru-RU number format group when it is default', () => {
      languageGetter.mockReturnValue('ru-RU');
      expect(getNumberFormatGroup()).toEqual(' ');
    });

    it('Get zh-CN number format group', () => {
      expect(getNumberFormatGroup('zh-CN')).toEqual(',');
    });

    it('Get zh-CN number format group when it is default', () => {
      languageGetter.mockReturnValue('zh-CN');
      expect(getNumberFormatGroup()).toEqual(',');
    });
  });

  describe('Parse date', () => {
    // Reference implementation mirroring the previous behavior, used to assert
    // the optimized parseDate stays byte-for-byte equivalent.
    const parseDateReference = (date: string): Date | undefined => {
      if (!date) {
        return undefined;
      }

      if (date?.length === 8) {
        const match = /^(\d{4})(\d{2})(\d{2})$/.exec(date);

        if (match) {
          const [, year, month, day] = match;
          date = `${year}-${month}-${day}`;
        }
      }

      const dateFormat = [
        'dd-MM-yyyy',
        'dd/MM/yyyy',
        'dd.MM.yyyy',
        'yyyy-MM-dd',
        'yyyy/MM/dd',
        'yyyy.MM.dd',
        'yyyyMMdd'
      ].find((format) => {
        return isMatch(date, format) && format.length === date.length;
      });

      if (dateFormat) {
        return parse(date, dateFormat, new Date());
      }

      return parseISO(date);
    };

    it('Returns undefined for empty input', () => {
      expect(parseDate('')).toBeUndefined();
      expect(parseDate(undefined as unknown as string)).toBeUndefined();
    });

    it('Parses canonical yyyy-MM-dd dates', () => {
      for (const date of [
        '2021-12-18',
        '2022-01-31',
        '2020-02-29',
        '1999-07-04'
      ]) {
        expect(parseDate(date)?.getTime()).toEqual(
          parseDateReference(date)?.getTime()
        );
      }
    });

    it('Parses yyyyMMdd dates', () => {
      expect(parseDate('20211218')?.getTime()).toEqual(
        parseDateReference('20211218')?.getTime()
      );
    });

    it('Parses alternative supported formats', () => {
      for (const date of [
        '18-12-2021',
        '18/12/2021',
        '18.12.2021',
        '2021/12/18',
        '2021.12.18'
      ]) {
        expect(parseDate(date)?.getTime()).toEqual(
          parseDateReference(date)?.getTime()
        );
      }
    });

    it('Rejects out-of-range canonical dates the same way as before', () => {
      for (const date of ['2021-13-01', '2021-00-10', '2021-02-30']) {
        expect(parseDate(date)?.getTime()).toEqual(
          parseDateReference(date)?.getTime()
        );
      }
    });

    it('Returns a fresh Date instance on each call (no shared mutable state)', () => {
      const first = parseDate('2021-12-18');
      const second = parseDate('2021-12-18');

      expect(first).not.toBe(second);
      expect(first?.getTime()).toEqual(second?.getTime());

      first?.setFullYear(1970);

      expect(parseDate('2021-12-18')?.getFullYear()).toEqual(2021);
    });
  });
});

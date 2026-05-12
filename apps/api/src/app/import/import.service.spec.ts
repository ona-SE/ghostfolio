import { ImportService } from './import.service';

describe('ImportService', () => {
  let service: ImportService;

  // Access private method via bracket notation for testing
  function validateActivityFields(params: {
    currency: string;
    dataSource: any;
    date: string;
    fee: number;
    index: number;
    quantity: number;
    symbol: string;
    type: string;
    unitPrice: number;
  }) {
    return (service as any).validateActivityFields(params);
  }

  beforeEach(() => {
    // Create a minimal instance — validateActivityFields is a pure function
    // that doesn't use any injected dependencies
    service = Object.create(ImportService.prototype);
  });

  describe('validateActivityFields', () => {
    const validActivity = {
      currency: 'USD',
      dataSource: 'YAHOO',
      date: '2024-01-15T00:00:00.000Z',
      fee: 5,
      index: 0,
      quantity: 10,
      symbol: 'AAPL',
      type: 'BUY',
      unitPrice: 150
    };

    it('should return no errors for a valid activity', () => {
      const errors = validateActivityFields(validActivity);
      expect(errors).toEqual([]);
    });

    it('should return an error when symbol is missing', () => {
      const errors = validateActivityFields({
        ...validActivity,
        symbol: ''
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.symbol',
            message: 'Symbol is required'
          })
        ])
      );
    });

    it('should return an error when symbol is undefined', () => {
      const errors = validateActivityFields({
        ...validActivity,
        symbol: undefined
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.symbol',
            message: 'Symbol is required'
          })
        ])
      );
    });

    it('should return an error when type is missing', () => {
      const errors = validateActivityFields({
        ...validActivity,
        type: ''
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.type',
            message: 'Type is required'
          })
        ])
      );
    });

    it('should return an error when type is invalid', () => {
      const errors = validateActivityFields({
        ...validActivity,
        type: 'INVALID'
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.type',
            message: expect.stringContaining('Type "INVALID" is not valid')
          })
        ])
      );
    });

    it('should accept all valid activity types', () => {
      for (const type of [
        'BUY',
        'DIVIDEND',
        'FEE',
        'INTEREST',
        'ITEM',
        'LIABILITY',
        'SELL'
      ]) {
        const errors = validateActivityFields({
          ...validActivity,
          type
        });

        const typeErrors = errors.filter((e) => e.field.includes('.type'));
        expect(typeErrors).toEqual([]);
      }
    });

    it('should return an error when date is missing', () => {
      const errors = validateActivityFields({
        ...validActivity,
        date: ''
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.date',
            message: 'Date is required'
          })
        ])
      );
    });

    it('should return an error when date is not valid ISO 8601', () => {
      const errors = validateActivityFields({
        ...validActivity,
        date: 'not-a-date'
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.date',
            message: expect.stringContaining('not a valid ISO 8601 date')
          })
        ])
      );
    });

    it('should return an error when date is before 1970', () => {
      const errors = validateActivityFields({
        ...validActivity,
        date: '1969-12-31T00:00:00.000Z'
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.date',
            message: 'Date must be after 1970'
          })
        ])
      );
    });

    it('should return an error when quantity is negative', () => {
      const errors = validateActivityFields({
        ...validActivity,
        quantity: -1
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.quantity',
            message: 'Quantity must be a non-negative number'
          })
        ])
      );
    });

    it('should return an error when quantity is undefined', () => {
      const errors = validateActivityFields({
        ...validActivity,
        quantity: undefined
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.quantity',
            message: 'Quantity is required'
          })
        ])
      );
    });

    it('should return an error when unitPrice is negative', () => {
      const errors = validateActivityFields({
        ...validActivity,
        unitPrice: -10
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.unitPrice',
            message: 'Unit price must be a non-negative number'
          })
        ])
      );
    });

    it('should return an error when unitPrice is undefined', () => {
      const errors = validateActivityFields({
        ...validActivity,
        unitPrice: undefined
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.unitPrice',
            message: 'Unit price is required'
          })
        ])
      );
    });

    it('should return an error when fee is negative', () => {
      const errors = validateActivityFields({
        ...validActivity,
        fee: -1
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.fee',
            message: 'Fee must be a non-negative number'
          })
        ])
      );
    });

    it('should return an error when fee is undefined', () => {
      const errors = validateActivityFields({
        ...validActivity,
        fee: undefined
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.fee',
            message: 'Fee is required'
          })
        ])
      );
    });

    it('should require currency for BUY type when dataSource is also missing', () => {
      const errors = validateActivityFields({
        ...validActivity,
        currency: undefined,
        dataSource: undefined
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'activities.0.currency',
            message: expect.stringContaining('Currency is required')
          })
        ])
      );
    });

    it('should not require currency for FEE type', () => {
      const errors = validateActivityFields({
        ...validActivity,
        currency: undefined,
        dataSource: undefined,
        type: 'FEE'
      });

      const currencyErrors = errors.filter((e) =>
        e.field.includes('.currency')
      );
      expect(currencyErrors).toEqual([]);
    });

    it('should not require currency for INTEREST type', () => {
      const errors = validateActivityFields({
        ...validActivity,
        currency: undefined,
        dataSource: undefined,
        type: 'INTEREST'
      });

      const currencyErrors = errors.filter((e) =>
        e.field.includes('.currency')
      );
      expect(currencyErrors).toEqual([]);
    });

    it('should not require currency for LIABILITY type', () => {
      const errors = validateActivityFields({
        ...validActivity,
        currency: undefined,
        dataSource: undefined,
        type: 'LIABILITY'
      });

      const currencyErrors = errors.filter((e) =>
        e.field.includes('.currency')
      );
      expect(currencyErrors).toEqual([]);
    });

    it('should collect multiple errors for an activity with several invalid fields', () => {
      const errors = validateActivityFields({
        currency: undefined,
        dataSource: undefined,
        date: '',
        fee: -1,
        index: 3,
        quantity: -5,
        symbol: '',
        type: 'INVALID',
        unitPrice: -10
      });

      expect(errors.length).toBeGreaterThanOrEqual(5);

      const fields = errors.map((e) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'activities.3.symbol',
          'activities.3.type',
          'activities.3.date',
          'activities.3.quantity',
          'activities.3.unitPrice'
        ])
      );
    });

    it('should use the correct index prefix', () => {
      const errors = validateActivityFields({
        ...validActivity,
        index: 7,
        symbol: ''
      });

      expect(errors[0].field).toBe('activities.7.symbol');
    });

    it('should allow zero quantity', () => {
      const errors = validateActivityFields({
        ...validActivity,
        quantity: 0
      });

      const quantityErrors = errors.filter((e) =>
        e.field.includes('.quantity')
      );
      expect(quantityErrors).toEqual([]);
    });

    it('should allow zero fee', () => {
      const errors = validateActivityFields({
        ...validActivity,
        fee: 0
      });

      const feeErrors = errors.filter((e) => e.field.includes('.fee'));
      expect(feeErrors).toEqual([]);
    });

    it('should allow zero unitPrice', () => {
      const errors = validateActivityFields({
        ...validActivity,
        unitPrice: 0
      });

      const priceErrors = errors.filter((e) => e.field.includes('.unitPrice'));
      expect(priceErrors).toEqual([]);
    });
  });
});

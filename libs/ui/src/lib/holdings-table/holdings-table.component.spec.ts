import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { holdings } from '../mocks/holdings';
import { GfHoldingsTableComponent } from './holdings-table.component';

// Stub the Ionic standalone entrypoints so importing the component under test
// does not pull their untransformed ESM bundles into the Jest runtime.
jest.mock('@ionic/angular/standalone', () => ({
  IonIcon: class {}
}));
jest.mock('ionicons', () => ({
  addIcons: () => undefined
}));
jest.mock('ionicons/icons', () => ({}));

describe('GfHoldingsTableComponent', () => {
  let component: GfHoldingsTableComponent;
  let fixture: ComponentFixture<GfHoldingsTableComponent>;

  // Read the protected `displayedColumns` computed signal without widening the
  // public surface of the component.
  const getDisplayedColumns = () =>
    (
      component as unknown as { displayedColumns: () => string[] }
    ).displayedColumns();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GfHoldingsTableComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
      // Drop the template and Material/Ionic child imports so these logic-only
      // tests don't require rendering the full mat-table sub-components.
      .overrideComponent(GfHoldingsTableComponent, {
        set: {
          imports: [],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
          template: ''
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GfHoldingsTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('holdings', holdings);
  });

  describe('Holdings % column (valueInPercentage)', () => {
    it('includes the Holdings % column when values are visible', () => {
      fixture.componentRef.setInput('hasPermissionToShowValues', true);

      expect(getDisplayedColumns()).toContain('valueInPercentage');
    });

    it('renders the Holdings % column directly after Allocation', () => {
      // The Holdings % column (share of total portfolio value, including cash)
      // is a distinct metric from Allocation (share of invested holdings) and
      // must sit immediately after it so the two percentages read together.
      fixture.componentRef.setInput('hasPermissionToShowValues', true);

      const columns = getDisplayedColumns();
      const allocationIndex = columns.indexOf('allocationInPercentage');
      const valueIndex = columns.indexOf('valueInPercentage');

      expect(allocationIndex).toBeGreaterThanOrEqual(0);
      expect(valueIndex).toBe(allocationIndex + 1);
    });

    it('keeps the Holdings % column even when values are hidden', () => {
      // Holdings % is a relative figure, not an absolute monetary value, so it
      // stays visible in the restricted/values-hidden view.
      fixture.componentRef.setInput('hasPermissionToShowValues', false);

      const columns = getDisplayedColumns();

      expect(columns).toContain('valueInPercentage');
      expect(columns).not.toContain('valueInBaseCurrency');
    });
  });

  describe('mock data contract', () => {
    it('exposes a numeric valueInPercentage for every holding', () => {
      for (const holding of holdings) {
        expect(typeof holding.valueInPercentage).toBe('number');
      }
    });
  });
});

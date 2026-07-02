import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { GfValueComponent } from './value.component';

// Stub the Ionic standalone entrypoints so importing the component under test
// does not pull their untransformed ESM bundles into the Jest runtime.
jest.mock('@ionic/angular/standalone', () => ({
  IonIcon: class {}
}));
jest.mock('ionicons', () => ({
  addIcons: () => undefined
}));
jest.mock('ionicons/icons', () => ({
  copyOutline: ''
}));

describe('GfValueComponent', () => {
  let component: GfValueComponent;
  let fixture: ComponentFixture<GfValueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GfValueComponent],
      providers: [{ provide: MatSnackBar, useValue: { open: () => undefined } }]
    })
      // Drop the template and child imports (e.g. IonIcon) so the logic-only
      // tests below don't require rendering Ionic/Material sub-components.
      .overrideComponent(GfValueComponent, {
        set: {
          imports: [],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
          template: ''
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GfValueComponent);
    component = fixture.componentInstance;
  });

  describe('isDate rendering', () => {
    it('renders a UTC-midnight date string on its stored calendar date', () => {
      // Account balance dates are stored anchored to UTC midnight and arrive as
      // date-only ISO strings. new Date("2024-01-15") is parsed as UTC midnight;
      // rendering it in the runtime's local timezone would shift the calendar
      // date by a day for users behind UTC. The display must stay UTC-anchored.
      component.isDate = true;
      component.locale = 'en-US';
      component.value = '2024-01-15';

      component.ngOnChanges();

      expect(component.formattedValue).toBe('01/15/2024');
    });

    it('does not roll a late-day UTC instant back to the previous day', () => {
      component.isDate = true;
      component.locale = 'en-US';
      component.value = '2024-01-15T23:30:00.000Z';

      component.ngOnChanges();

      expect(component.formattedValue).toBe('01/15/2024');
    });

    it('honors the mobile two-digit year format while staying UTC-anchored', () => {
      component.isDate = true;
      component.deviceType = 'mobile';
      component.locale = 'en-US';
      component.value = '2024-01-15';

      component.ngOnChanges();

      expect(component.formattedValue).toBe('01/15/24');
    });
  });
});

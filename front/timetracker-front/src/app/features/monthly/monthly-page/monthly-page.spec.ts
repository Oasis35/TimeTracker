import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { MonthlyPageComponent } from './monthly-page';

describe('MonthlyPageComponent', () => {
  const monthResponse = {
    year: 2026,
    month: 2,
    days: ['2026-02-01', '2026-02-02'],
    rows: [
      {
        ticketId: 1,
        type: 'DEV',
        externalKey: 'ABC-1',
        label: 'Ticket ABC-1',
        values: { '2026-02-01': 120 },
        total: 120,
      },
      {
        ticketId: 2,
        type: 'SUPPORT',
        externalKey: 'INC-9',
        label: 'Incident',
        values: { '2026-02-01': 60 },
        total: 60,
      },
    ],
    totalsByDay: { '2026-02-01': 180 },
    minutesPerDay: 480,
  };

  function setup() {
    const getMonthCalls: Array<{ year: number; month: number }> = [];
    const navigateCalls: unknown[] = [];
    const routerNavigate = (...args: unknown[]) => {
      navigateCalls.push(args);
      return Promise.resolve(true);
    };

    const apiMock = {
      getMonth: (year: number, month: number) => {
        getMonthCalls.push({ year, month });
        return of(monthResponse);
      },
    };

    TestBed.configureTestingModule({
      imports: [MonthlyPageComponent],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    const fixture = TestBed.createComponent(MonthlyPageComponent);
    return { fixture, component: fixture.componentInstance, getMonthCalls, navigateCalls };
  }

  it('renders excel-like ticket table with day/time chips', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('.excel-row');
    expect(rows.length).toBe(2);
    expect(compiled.textContent).toContain('DEV - ABC-1 - Ticket ABC-1');
    expect(compiled.textContent).toContain('D1');
  });

  it('filters tickets using the toolbar input', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.updateTicketFilter('INC-9');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('.excel-row');
    expect(rows.length).toBe(1);
    expect(compiled.textContent).toContain('SUPPORT - INC-9 - Incident');
  });

  it('loads previous and next month when navigation is used', async () => {
    const { fixture, component, getMonthCalls } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.prevMonth();
    fixture.detectChanges();
    await fixture.whenStable();

    component.nextMonth();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getMonthCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('navigates to timesheet day details when a day is selected', async () => {
    const { fixture, component, navigateCalls } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.openDayDetails('2026-02-02');

    expect(navigateCalls[0]).toEqual([['/'], { queryParams: { day: '2026-02-02' } }]);
  });
});

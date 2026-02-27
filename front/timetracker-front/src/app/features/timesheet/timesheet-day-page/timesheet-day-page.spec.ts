import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { UnitService } from '../../../core/services/unit.service';
import { TimesheetDayPageComponent } from './timesheet-day-page';
import { provideRouter } from '@angular/router';

describe('TimesheetDayPageComponent', () => {
  const metadata = {
    hoursPerDay: 8,
    minutesPerDay: 480,
    allowedMinutesDayMode: [0, 120, 240, 360, 480],
    allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
    defaultUnit: 'day' as const,
    defaultType: 'DEV',
    tickets: [{ id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1' }],
  };

  const month = {
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
    ],
    totalsByDay: { '2026-02-01': 120, '2026-02-02': 0 },
  };

  function setup() {
    let capturedUpsert: unknown = null;
    const usedByMonthCalls: Array<{ year: number; month: number }> = [];
    const usedTickets = metadata.tickets;
    const monthData = month;
    const ticketTotals = [{ ticketId: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1', total: 120 }];
    const apiMock = {
      getMetadata: () => of(metadata),
      getMonth: () => of(monthData),
      getUsedByMonth: (year: number, month: number) => {
        usedByMonthCalls.push({ year, month });
        return of(usedTickets);
      },
      getTicketTotals: () => of(ticketTotals),
      upsertTimeEntry: (dto: unknown) => {
        capturedUpsert = dto;
        return of(void 0);
      },
    };

    TestBed.configureTestingModule({
      imports: [
        TimesheetDayPageComponent,
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: TrackerApi, useValue: apiMock }, provideRouter([])],
    });

    const fixture = TestBed.createComponent(TimesheetDayPageComponent);
    const unit = TestBed.inject(UnitService);
    return {
      fixture,
      component: fixture.componentInstance,
      unit,
      getCapturedUpsert: () => capturedUpsert,
      getUsedByMonthCalls: () => usedByMonthCalls,
    };
  }

  it('renders the new ticket dialog trigger', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.open-ticket-dialog');
    expect(button).not.toBeNull();
  });

  it('sends selected minutes when pointing time', async () => {
    const { fixture, component, getCapturedUpsert } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSelectedDay('2026-02-02');
    await component.pointMinutes(1, 360);

    const dto = getCapturedUpsert() as { quantityMinutes: number; ticketId: number; date: string } | null;
    expect(dto).not.toBeNull();
    expect(dto?.ticketId).toBe(1);
    expect(dto?.date).toBe('2026-02-02');
    expect(dto?.quantityMinutes).toBe(360);
  });

  it('uses hour options and formatting when global unit mode is hour', async () => {
    const { fixture, component, unit } = setup();
    unit.setUnitMode('hour');
    fixture.detectChanges();
    await fixture.whenStable();

    const options = component.quickPickOptions().map((o) => o.minutes);
    expect(options).toEqual(metadata.allowedMinutesHourMode);
    expect(component.formatEntryValue(60)).toContain('h');
  });

  it('does not override selected global unit mode from metadata default', async () => {
    const { fixture, component, unit } = setup();
    unit.setUnitMode('hour');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(unit.unitMode()).toBe('hour');
    expect(component.quickPickOptions().map((o) => o.minutes)).toEqual(
      metadata.allowedMinutesHourMode,
    );
  });

  it('reloads used tickets for the new month when month changes', async () => {
    const { fixture, component, getUsedByMonthCalls } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.month.set(3);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getUsedByMonthCalls()).toContainEqual({ year: 2026, month: 2 });
    expect(getUsedByMonthCalls()).toContainEqual({ year: 2026, month: 3 });
  });

  it('hides archived ticket when selected day has zero logged time on it', async () => {
    const archivedTicket = { id: 2, type: 'DEV', externalKey: 'ABC-2', label: 'Ticket ABC-2', isCompleted: true };
    const openTicket = { id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1', isCompleted: false };
    const apiMock = {
      getMetadata: () => of(metadata),
      getMonth: () =>
        of({
          year: 2026,
          month: 2,
          days: ['2026-02-01', '2026-02-02'],
          rows: [
            {
              ticketId: 1,
              type: 'DEV',
              externalKey: 'ABC-1',
              label: 'Ticket ABC-1',
              values: { '2026-02-01': 120, '2026-02-02': 0 },
            },
            {
              ticketId: 2,
              type: 'DEV',
              externalKey: 'ABC-2',
              label: 'Ticket ABC-2',
              values: { '2026-02-01': 60, '2026-02-02': 0 },
            },
          ],
          totalsByDay: { '2026-02-01': 180, '2026-02-02': 0 },
        }),
      getUsedByMonth: () => of([openTicket, archivedTicket]),
      getTicketTotals: () =>
        of([
          { ticketId: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1', total: 120 },
          { ticketId: 2, type: 'DEV', externalKey: 'ABC-2', label: 'Ticket ABC-2', total: 60 },
        ]),
      upsertTimeEntry: () => of(void 0),
    };

    TestBed.configureTestingModule({
      imports: [TimesheetDayPageComponent, TranslateModule.forRoot()],
      providers: [{ provide: TrackerApi, useValue: apiMock }, provideRouter([])],
    });

    const fixture = TestBed.createComponent(TimesheetDayPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSelectedDay('2026-02-02');
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = component.displayRows();
    expect(rows.length).toBe(1);
    expect(rows[0]?.ticketId).toBe(1);
  });
});


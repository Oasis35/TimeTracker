import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketDto, TicketTotalDto, TimesheetMetadataDto, TimesheetMonthDto } from '../../../core/api/models';
import { UnitService } from '../../../core/services/unit.service';
import { TimesheetDayPageComponent } from './timesheet-day-page';
import { provideRouter } from '@angular/router';

describe('TimesheetDayPageComponent', () => {
  const metadata: TimesheetMetadataDto = {
    minutesPerDay: 480,
    allowedMinutesDayMode: [0, 120, 240, 360, 480],
    allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
    defaultUnit: 'day' as const,
    defaultType: 'DEV',
    tickets: [{ id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1', isCompleted: false }],
  };

  const month: TimesheetMonthDto = {
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
      },
    ],
    totalsByDay: { '2026-02-01': 120, '2026-02-02': 0 },
  };

  function setup(options?: {
    metadata?: TimesheetMetadataDto;
    monthData?: TimesheetMonthDto;
    usedTickets?: TicketDto[];
    ticketTotals?: TicketTotalDto[];
    dialogCloseResult?: unknown;
    dialogCloseResults?: unknown[];
  }) {
    let capturedUpsert: unknown = null;
    const usedByMonthCalls: Array<{ year: number; month: number }> = [];
    const metadataData = options?.metadata ?? metadata;
    const usedTickets = options?.usedTickets ?? metadataData.tickets;
    const monthData = options?.monthData ?? month;
    const ticketTotals = options?.ticketTotals ?? [
      { ticketId: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket ABC-1', total: 120 },
    ];
    const apiMock = {
      getMetadata: vi.fn(() => of(metadataData)),
      getMonth: vi.fn(() => of(monthData)),
      getUsedByMonth: vi.fn((year: number, month: number) => {
        usedByMonthCalls.push({ year, month });
        return of(usedTickets);
      }),
      getTicketTotals: vi.fn(() => of(ticketTotals)),
      upsertTimeEntry: vi.fn((dto: unknown) => {
        capturedUpsert = dto;
        return of(void 0);
      }),
      getSettings: vi.fn(() => of({})),
      setSetting: vi.fn(() => of(void 0)),
      deleteSetting: vi.fn(() => of(void 0)),
      getPublicHolidaysMetropole: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [
        TimesheetDayPageComponent,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(TimesheetDayPageComponent);
    const dialogResults = [...(options?.dialogCloseResults ?? [options?.dialogCloseResult ?? false])];
    const dialogOpen = vi.fn().mockImplementation(() => ({
      afterClosed: () => of(dialogResults.shift() ?? false),
    }));
    (fixture.componentInstance as any).dialog = { open: dialogOpen };
    const unit = TestBed.inject(UnitService);
    return {
      fixture,
      component: fixture.componentInstance,
      unit,
      getCapturedUpsert: () => capturedUpsert,
      getUsedByMonthCalls: () => usedByMonthCalls,
      dialogOpen,
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
    component.year.set(2026);
    component.month.set(2);
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
      getSettings: () => of({}),
      setSetting: () => of(void 0),
      deleteSetting: () => of(void 0),
      getPublicHolidaysMetropole: () => of({}),
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
    expect(rows.length).toBe(0);
  });

  it('exposes month tickets as default lookup candidates', async () => {
    const { fixture, component } = setup({
      monthData: {
        year: 2026,
        month: 2,
        days: ['2026-02-01'],
        rows: [
          {
            ticketId: 3,
            type: 'DEV',
            externalKey: '100',
            label: 'Ticket 100',
            values: { '2026-02-01': 60 },
          },
          {
            ticketId: 4,
            type: 'DEV',
            externalKey: '20',
            label: 'Ticket 20',
            values: { '2026-02-01': 120 },
          },
        ],
        totalsByDay: { '2026-02-01': 180 },
      },
      usedTickets: [
        { id: 3, type: 'DEV', externalKey: '100', label: 'Ticket 100', isCompleted: true },
        { id: 4, type: 'DEV', externalKey: '20', label: 'Ticket 20', isCompleted: false },
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const keys = component.daySearchDefaultTickets().map((t) => t.externalKey);

    expect(keys).toEqual(['20']);
  });

  it('exposes open metadata tickets as searchable lookup candidates', async () => {
    const { fixture, component } = setup({
      metadata: {
        ...metadata,
        tickets: [
          { id: 1, type: 'DEV', externalKey: '6501', label: 'Exact', isCompleted: false },
          { id: 2, type: 'DEV', externalKey: '65010', label: 'Prefix', isCompleted: false },
          { id: 3, type: 'DEV', externalKey: 'A6501B', label: 'Contains', isCompleted: false },
          { id: 4, type: 'DEV', externalKey: '06501', label: 'Contains 2', isCompleted: false },
          { id: 5, type: 'DEV', externalKey: '65011', label: 'Archived', isCompleted: true },
        ],
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const keys = component.daySearchAllTickets().map((t) => t.externalKey);

    expect(keys).toEqual(['6501', '65010', 'A6501B', '06501']);
  });

  it('sets an error and does not open dialog when no day is selected', async () => {
    const { fixture, component, dialogOpen } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.selectedDay.set('');
    component.openTicketEntryDialog({
      id: 1,
      type: 'DEV',
      externalKey: 'ABC-1',
      label: 'Ticket ABC-1',
      isCompleted: false,
    });

    expect(component.actionError()).toBe('day_required_before_log');
    expect(dialogOpen).not.toHaveBeenCalled();
  });


  it('opens time entry dialog after creating a ticket from add ticket dialog', async () => {
    const createdTicket: TicketDto = {
      id: 9,
      type: 'DEV',
      externalKey: 'NEW-9',
      label: 'New ticket',
      isCompleted: false,
    };
    const { fixture, component, dialogOpen } = setup({
      dialogCloseResults: [{ ticket: createdTicket, logTime: true }, false],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSelectedDay('2026-02-01');
    const openTicketEntrySpy = vi.spyOn(component, 'openTicketEntryDialog');

    component.openAddTicketDialog();
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledTimes(2);
    expect(openTicketEntrySpy).toHaveBeenCalledWith(createdTicket);
  });

  it('does not open time entry dialog when logTime is false after ticket creation', async () => {
    const createdTicket: TicketDto = {
      id: 9,
      type: 'DEV',
      externalKey: 'NEW-9',
      label: 'New ticket',
      isCompleted: false,
    };
    const { fixture, component, dialogOpen } = setup({
      dialogCloseResults: [{ ticket: createdTicket, logTime: false }],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSelectedDay('2026-02-01');
    const openTicketEntrySpy = vi.spyOn(component, 'openTicketEntryDialog');

    component.openAddTicketDialog();
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(openTicketEntrySpy).not.toHaveBeenCalled();
  });

  it('opens time entry dialog and forwards selected minutes', async () => {
    const { fixture, component, dialogOpen } = setup({ dialogCloseResult: 240 });
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSelectedDay('2026-02-01');
    const pointSpy = vi.spyOn(component, 'pointMinutes').mockResolvedValue();

    component.openTicketEntryDialog({
      id: 1,
      type: 'DEV',
      externalKey: 'ABC-1',
      label: 'Ticket ABC-1',
      isCompleted: false,
    });
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalled();
    expect(pointSpy).toHaveBeenCalledWith(1, 240);
  });
});

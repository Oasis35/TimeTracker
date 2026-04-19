import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BehaviorSubject } from 'rxjs';
import { ParamMap, convertToParamMap } from '@angular/router';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TimesheetWeekPageComponent } from './timesheet-week-page';

describe('TimesheetWeekPageComponent', () => {
  // Week 16 of 2026: Mon 2026-04-13 → Sun 2026-04-19
  const WEEK = 16;
  const YEAR = 2026;

  const baseMetadata = {
    minutesPerDay: 480,
    allowedMinutesDayMode: [0, 120, 240, 360, 480],
    allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
    defaultUnit: 'day' as const,
    defaultType: 'DEV',
    tickets: [],
  };

  const baseMonth = {
    year: 2026,
    month: 4,
    days: [
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17',
      '2026-04-18', '2026-04-19',
    ],
    rows: [
      {
        ticketId: 1,
        type: 'DEV',
        externalKey: '100',
        label: 'Feature A',
        values: { '2026-04-13': 240, '2026-04-14': 120 },
      },
      {
        ticketId: 2,
        type: 'DEV',
        externalKey: '200',
        label: 'Feature B',
        values: { '2026-04-15': 480 },
      },
    ],
    totalsByDay: { '2026-04-13': 240, '2026-04-14': 120, '2026-04-15': 480 },
  };

  function setup(options?: {
    queryParams?: Record<string, string>;
    dialogResults?: unknown[];
  }) {
    const dialogResults = [...(options?.dialogResults ?? [false])];
    const queryParamMap$ = new BehaviorSubject<ParamMap>(
      convertToParamMap(options?.queryParams ?? { week: String(WEEK), year: String(YEAR) }),
    );

    const apiMock = {
      getMetadata: vi.fn(() => of(baseMetadata)),
      getMonth: vi.fn(() => of(baseMonth)),
      getAllTickets: vi.fn(() => of([])),
      getTicketTotals: vi.fn(() => of([])),
      getPublicHolidaysMetropole: vi.fn(() => of({})),
      upsertTimeEntry: vi.fn(() => of(void 0)),
      getSettings: vi.fn(() => of({})),
      setSetting: vi.fn(() => of(void 0)),
      deleteSetting: vi.fn(() => of(void 0)),
    };

    TestBed.configureTestingModule({
      imports: [TimesheetWeekPageComponent, MatDialogModule, TranslateModule.forRoot()],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } },
        provideAnimationsAsync(),
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(TimesheetWeekPageComponent);
    const component = fixture.componentInstance;
    const dialogOpen = vi.spyOn((component as any).dialog, 'open').mockImplementation(() => ({
      afterClosed: () => of(dialogResults.shift() ?? false),
    }) as any);

    return { fixture, component, apiMock, dialogOpen };
  }

  it('initialises isoWeek and weekYear from route query params', async () => {
    const { fixture, component } = setup({ queryParams: { week: '16', year: '2026' } });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isoWeek()).toBe(16);
    expect(component.weekYear()).toBe(2026);
  });

  it('ignores invalid query params and keeps numeric defaults', async () => {
    const { fixture, component } = setup({ queryParams: { week: 'abc', year: '2026' } });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(typeof component.isoWeek()).toBe('number');
    expect(typeof component.weekYear()).toBe('number');
  });

  it('renders ticket columns for entries that exist this week', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('100');
    expect(el.textContent).toContain('200');
  });

  it('hides weekend rows in the table', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const weekendRows = component.dayRows().filter((r) => r.isWeekend);
    expect(weekendRows.length).toBe(2);

    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5); // Mon–Fri only
  });

  it('computes correct weekTotal', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    // 240 + 120 + 480 = 840
    expect(component.weekTotal()).toBe(840);
  });

  it('computes correct colTotals per ticket', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const totals = component.colTotals();
    expect(totals.get(1)).toBe(360); // 240 + 120
    expect(totals.get(2)).toBe(480);
  });

  it('pickerDateFilter blocks weekends', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const filter = component.pickerDateFilter();
    expect(filter(new Date('2026-04-18T00:00:00'))).toBe(false); // Saturday
    expect(filter(new Date('2026-04-19T00:00:00'))).toBe(false); // Sunday
    expect(filter(new Date('2026-04-13T00:00:00'))).toBe(true);  // Monday
  });

  it('pickerDateFilter blocks public holidays', async () => {
    const holidayDate = '2026-04-14';
    TestBed.resetTestingModule();

    const queryParamMap$ = new BehaviorSubject<ParamMap>(
      convertToParamMap({ week: String(WEEK), year: String(YEAR) }),
    );
    const apiMock = {
      getMetadata: vi.fn(() => of(baseMetadata)),
      getMonth: vi.fn(() => of(baseMonth)),
      getAllTickets: vi.fn(() => of([])),
      getTicketTotals: vi.fn(() => of([])),
      getPublicHolidaysMetropole: vi.fn(() => of({ [holidayDate]: 'Jour férié test' })),
      upsertTimeEntry: vi.fn(() => of(void 0)),
      getSettings: vi.fn(() => of({})),
      setSetting: vi.fn(() => of(void 0)),
      deleteSetting: vi.fn(() => of(void 0)),
    };
    TestBed.configureTestingModule({
      imports: [TimesheetWeekPageComponent, MatDialogModule, TranslateModule.forRoot()],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } },
        provideAnimationsAsync(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(TimesheetWeekPageComponent);
    vi.spyOn((fixture.componentInstance as any).dialog, 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as any);
    fixture.detectChanges();
    await fixture.whenStable();

    const filter = fixture.componentInstance.pickerDateFilter();
    expect(filter(new Date(`${holidayDate}T00:00:00`))).toBe(false);
    expect(filter(new Date('2026-04-13T00:00:00'))).toBe(true);
  });

  it('onDateSelected updates isoWeek and weekYear', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const picker = { close: vi.fn() } as any;
    component.onDateSelected(new Date('2026-01-05T00:00:00'), picker); // ISO week 2 of 2026
    expect(component.isoWeek()).toBe(2);
    expect(component.weekYear()).toBe(2026);
    expect(picker.close).toHaveBeenCalled();
  });

  it('onDateSelected handles null gracefully', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const picker = { close: vi.fn() } as any;
    const weekBefore = component.isoWeek();
    component.onDateSelected(null, picker);
    expect(component.isoWeek()).toBe(weekBefore); // unchanged
    expect(picker.close).not.toHaveBeenCalled();
  });

  it('does not open time entry dialog when add ticket logTime is false', async () => {
    const createdTicket = { id: 9, type: 'DEV', externalKey: 'NEW-9', label: 'New', isCompleted: false };
    const { fixture, component, dialogOpen } = setup({
      dialogResults: [{ ticket: createdTicket, logTime: false }],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.openAddTicketDialog();
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('opens time entry dialog when add ticket logTime is true', async () => {
    const createdTicket = { id: 9, type: 'DEV', externalKey: 'NEW-9', label: 'New', isCompleted: false };
    const { fixture, component, dialogOpen } = setup({
      dialogResults: [{ ticket: createdTicket, logTime: true }, undefined],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.openAddTicketDialog();
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledTimes(2);
  });

  it('calls upsertTimeEntry with correct args on cell click', async () => {
    const { fixture, component, apiMock } = setup({ dialogResults: [480] });
    fixture.detectChanges();
    await fixture.whenStable();

    const cols = component.ticketCols();
    const rows = component.dayRows().filter((r) => !r.isWeekend && !r.isHoliday);
    expect(cols.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);

    component.onCellClick(rows[0], cols[0]);
    await fixture.whenStable();

    expect(apiMock.upsertTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: cols[0].ticketId, quantityMinutes: 480 }),
    );
  });
});

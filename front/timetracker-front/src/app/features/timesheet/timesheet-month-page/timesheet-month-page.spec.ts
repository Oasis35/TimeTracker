import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TimesheetMonthPageComponent } from './timesheet-month-page';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';

describe('TimesheetMonthPageComponent', () => {
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
    month: 2,
    days: ['2026-02-01', '2026-02-02'],
    rows: [
      {
        ticketId: 1,
        type: 'DEV',
        externalKey: '64205',
        label: 'Securite API',
        values: { '2026-02-01': 120, '2026-02-02': 240 },
      },
    ],
    totalsByDay: { '2026-02-01': 120, '2026-02-02': 240 },
  };

  function setup(options?: { dialogResults?: unknown[] }) {
    const dialogResults = [...(options?.dialogResults ?? [false])];

    const apiMock = {
      getMetadata: vi.fn(() => of(baseMetadata)),
      getMonth: vi.fn(() => of(baseMonth)),
      getUsedByMonth: vi.fn(() =>
        of([{ id: 1, type: 'DEV', externalKey: '64205', label: 'Securite API' }]),
      ),
      getPublicHolidaysMetropole: vi.fn(() => of({ '2026-02-02': 'Lundi test' })),
      getTicketTotals: vi.fn(() => of([{ ticketId: 1, type: 'DEV', externalKey: '64205', label: 'Securite API', total: 900 }])),
      upsertTimeEntry: vi.fn(() => of(void 0)),
      getSettings: vi.fn(() => of({})),
      setSetting: vi.fn(() => of(void 0)),
      deleteSetting: vi.fn(() => of(void 0)),
    };

    TestBed.configureTestingModule({
      imports: [TimesheetMonthPageComponent, MatDialogModule, TranslateModule.forRoot()],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        provideAnimationsAsync(),
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(TimesheetMonthPageComponent);
    const component = fixture.componentInstance;
    const dialogOpen = vi.spyOn((component as any).dialog, 'open').mockImplementation(() => ({
      afterClosed: () => of(dialogResults.shift() ?? false),
    }) as any);

    return { fixture, component, apiMock, dialogOpen };
  }

  it('renders monthly matrix with days and values', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('thead th').length).toBeGreaterThan(4);
    expect(el.textContent).toContain('64205');
    expect(el.textContent).toContain('Securite API');
  });

  it('alternates week block based on ISO week parity', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    // baseMonth has days: ['2026-02-01', '2026-02-02']
    // 2026-02-01 = Sunday, ISO week 5 (odd)  → true
    // 2026-02-02 = Monday, ISO week 6 (even) → false
    expect(component.isAlternateWeekBlock(0)).toBe(true);
    expect(component.isAlternateWeekBlock(1)).toBe(false);
    // out-of-range index returns false
    expect(component.isAlternateWeekBlock(99)).toBe(false);
  });

  it('computes correct month total across all tickets and days', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    // row has 120 + 240 = 360 minutes total
    expect(component.monthTotal()).toBe(360);
  });

  it('does not open time entry dialog when logTime is false', async () => {
    const createdTicket = { id: 9, type: 'DEV', externalKey: 'NEW-9', label: 'New' };
    const { fixture, component, dialogOpen } = setup({
      dialogResults: [{ ticket: createdTicket, logTime: false }],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.openAddTicketDialog();
    await fixture.whenStable();

    // Only the add-ticket dialog should have been opened, not the time entry dialog
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('opens time entry dialog when logTime is true', async () => {
    const createdTicket = { id: 9, type: 'DEV', externalKey: 'NEW-9', label: 'New' };
    const { fixture, component, dialogOpen } = setup({
      dialogResults: [{ ticket: createdTicket, logTime: true }, undefined],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.openAddTicketDialog();
    await fixture.whenStable();

    // Both add-ticket and time-entry dialogs should have been opened
    expect(dialogOpen).toHaveBeenCalledTimes(2);
  });

  it('reloads data after ticket is created', async () => {
    const createdTicket = { id: 9, type: 'DEV', externalKey: 'NEW-9', label: 'New' };
    const { fixture, component, apiMock } = setup({
      dialogResults: [{ ticket: createdTicket, logTime: false }],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const callsBefore = apiMock.getMonth.mock.calls.length;
    component.openAddTicketDialog();
    await fixture.whenStable();

    expect(apiMock.getMonth.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { UnitService } from '../../../core/services/unit.service';
import { TimesheetPageComponent } from './timesheet-page';

describe('TimesheetPageComponent', () => {
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
    let capturedCreateTicket: unknown = null;
    const usedByMonthCalls: Array<{ year: number; month: number }> = [];
    const apiMock = {
      getMetadata: () => of(metadata),
      getMonth: () => of(month),
      getUsedByMonth: (year: number, month: number) => {
        usedByMonthCalls.push({ year, month });
        return of(metadata.tickets);
      },
      createTicket: (dto: unknown) => {
        capturedCreateTicket = dto;
        return of({ id: 99, type: 'DEV', externalKey: null, label: null });
      },
      upsertTimeEntry: (dto: unknown) => {
        capturedUpsert = dto;
        return of(void 0);
      },
    };

    TestBed.configureTestingModule({
      imports: [TimesheetPageComponent],
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });

    const fixture = TestBed.createComponent(TimesheetPageComponent);
    const unit = TestBed.inject(UnitService);
    return {
      fixture,
      component: fixture.componentInstance,
      unit,
      getCapturedUpsert: () => capturedUpsert,
      getCapturedCreateTicket: () => capturedCreateTicket,
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

  it('submits ticket creation and lets backend validate payload', async () => {
    const { component, getCapturedCreateTicket } = setup();
    component.newTicketType.set('DEV');
    component.newTicketExternalKey.set('ABC-9');
    component.newTicketLabel.set('');

    await component.addTicket();

    const dto = getCapturedCreateTicket() as { type: string; externalKey: string | null; label: string | null };
    expect(dto).toEqual({ type: 'DEV', externalKey: 'ABC-9', label: null });
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
});

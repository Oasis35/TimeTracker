import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
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
    const apiMock = {
      getMetadata: () => of(metadata),
      getMonth: () => of(month),
      createTicket: () => of({ id: 99, type: 'DEV', externalKey: null, label: null }),
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
    return { fixture, component: fixture.componentInstance, getCapturedUpsert: () => capturedUpsert };
  }

  it('renders the new ticket dialog trigger', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.open-ticket-dialog');
    expect(button).not.toBeNull();
  });

  it('shows validation error when external key is set without label', async () => {
    const { component } = setup();
    component.newTicketType.set('DEV');
    component.newTicketExternalKey.set('ABC-9');
    component.newTicketLabel.set('');

    await component.addTicket();

    expect(component.actionError()).toContain('label');
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
});

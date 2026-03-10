import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketsGridPageComponent } from './tickets-grid-page';

describe('TicketsGridPageComponent', () => {
  const metadata = {
    minutesPerDay: 480,
    allowedMinutesDayMode: [0, 120, 240, 360, 480],
    allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
    defaultUnit: 'day' as const,
    defaultType: 'DEV',
    tickets: [],
  };

  function setup(options?: { totals?: number; completed?: boolean }) {
    const ticketId = 1;
    const totals = options?.totals ?? 0;
    const isCompleted = options?.completed ?? false;
    const apiMock = {
      getAllTickets: vi.fn().mockReturnValue(
        of([
          { id: ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API', isCompleted },
        ]),
      ),
      getTicketTotals: vi.fn().mockReturnValue(
        of([
          { ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API', total: totals },
        ]),
      ),
      getMetadata: vi.fn().mockReturnValue(of(metadata)),
      setTicketCompletion: vi.fn().mockReturnValue(
        of({ id: ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API', isCompleted: true }),
      ),
      deleteTicket: vi.fn().mockReturnValue(of(void 0)),
      updateTicket: vi.fn().mockReturnValue(
        of({ id: ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API', isCompleted }),
      ),
    };
    const dialogMock = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(false) }),
    };

    TestBed.configureTestingModule({
      imports: [
        TicketsGridPageComponent,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        { provide: MatDialog, useValue: dialogMock },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(TicketsGridPageComponent);
    return { fixture };
  }

  it('disables completion action when ticket has no logged time and is not completed', async () => {
    const { fixture } = setup({ totals: 0, completed: false });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'td.mat-column-completed button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
  });

  it('keeps completion action enabled when ticket is already completed', async () => {
    const { fixture } = setup({ totals: 0, completed: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // "completed" rows are hidden by default filter, so switch to "all".
    fixture.componentInstance.onCompletionFilterChange('all');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'td.mat-column-completed button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
  });
});

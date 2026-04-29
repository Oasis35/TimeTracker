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

  function setup(options?: { totals?: number }) {
    const ticketId = 1;
    const totals = options?.totals ?? 0;
    const apiMock = {
      getAllTickets: vi.fn().mockReturnValue(
        of([
          { id: ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API' },
        ]),
      ),
      getTicketTotals: vi.fn().mockReturnValue(
        of([
          { ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API', total: totals },
        ]),
      ),
      getMetadata: vi.fn().mockReturnValue(of(metadata)),
      deleteTicket: vi.fn().mockReturnValue(of(void 0)),
      updateTicket: vi.fn().mockReturnValue(
        of({ id: ticketId, type: 'DEV', externalKey: '64205', label: 'Securite API' }),
      ),
      getSettings: vi.fn().mockReturnValue(of({})),
      setSetting: vi.fn().mockReturnValue(of(void 0)),
      deleteSetting: vi.fn().mockReturnValue(of(void 0)),
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

  it('renders the ticket grid', async () => {
    const { fixture } = setup({ totals: 0 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('table') as HTMLTableElement | null;
    expect(table).not.toBeNull();
  });

  it('disables delete button when ticket has logged time', async () => {
    const { fixture } = setup({ totals: 120 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deleteBtn = fixture.nativeElement.querySelector(
      '.action-delete',
    ) as HTMLButtonElement | null;
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.disabled).toBe(true);
  });
});

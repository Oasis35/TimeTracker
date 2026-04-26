import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketDetailPageComponent } from './ticket-detail-page';

describe('TicketDetailPageComponent', () => {
  function setup() {
    const apiMock = {
      getMetadata: () =>
        of({
          minutesPerDay: 480,
          allowedMinutesDayMode: [0, 120, 240, 360, 480],
          allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
          defaultUnit: 'day' as const,
          defaultType: 'DEV',
          tickets: [{ id: 1, type: 'DEV', externalKey: '65010', label: 'Refonte' }],
        }),
      getTicketDetail: () =>
        of({
          ticket: { id: 1, type: 'DEV', externalKey: '65010', label: 'Refonte' },
          entries: [{ date: '2026-03-10', quantityMinutes: 240 }],
          totalMinutes: 240,
          currentMonthMinutes: 0,
          previousMonthMinutes: 240,
        }),
      getPublicHolidaysMetropole: () => of({}),
      upsertTimeEntry: () => of(void 0),
      getSettings: () => of({}),
      setSetting: () => of(void 0),
      deleteSetting: () => of(void 0),
    };

    TestBed.configureTestingModule({
      imports: [TicketDetailPageComponent, TranslateModule.forRoot()],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.componentInstance.ticketId.set(1);
    return fixture;
  }

  it('renders ticket detail view', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('65010');
  });

  it('renders entry rows with edit and add buttons', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.entry-row')).not.toBeNull();
    expect(compiled.querySelector('.entry-edit-btn')).not.toBeNull();
    expect(compiled.querySelector('.month-add-btn')).not.toBeNull();
  });
});

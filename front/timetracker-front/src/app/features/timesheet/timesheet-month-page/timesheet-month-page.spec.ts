import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TimesheetMonthPageComponent } from './timesheet-month-page';
import { provideRouter } from '@angular/router';

describe('TimesheetMonthPageComponent', () => {
  function setup() {
    const apiMock = {
      getMetadata: () =>
        of({
          hoursPerDay: 8,
          minutesPerDay: 480,
          allowedMinutesDayMode: [0, 120, 240, 360, 480],
          allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
          defaultUnit: 'day' as const,
          defaultType: 'DEV',
          tickets: [],
        }),
      getMonth: () =>
        of({
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
        }),
      getUsedByMonth: () =>
        of([{ id: 1, type: 'DEV', externalKey: '64205', label: 'Securite API', isCompleted: false }]),
      getPublicHolidaysMetropole: () => of({ '2026-02-02': 'Lundi test' }),
    };

    TestBed.configureTestingModule({
      imports: [TimesheetMonthPageComponent, TranslateModule.forRoot()],
      providers: [{ provide: TrackerApi, useValue: apiMock }, provideRouter([])],
    });

    return TestBed.createComponent(TimesheetMonthPageComponent);
  }

  it('renders monthly matrix with days and values', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('thead th').length).toBeGreaterThan(4);
    expect(el.textContent).toContain('64205');
    expect(el.textContent).toContain('Securite API');
  });
});

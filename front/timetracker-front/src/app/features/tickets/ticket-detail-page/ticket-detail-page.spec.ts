import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketDetailPageComponent } from './ticket-detail-page';

describe('TicketDetailPageComponent', () => {
  function setup(isCompleted = false) {
    const apiMock = {
      getMetadata: () =>
        of({
          hoursPerDay: 8,
          minutesPerDay: 480,
          allowedMinutesDayMode: [0, 120, 240, 360, 480],
          allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
          defaultUnit: 'day' as const,
          defaultType: 'DEV',
          tickets: [{ id: 1, type: 'DEV', externalKey: '65010', label: 'Refonte', isCompleted }],
        }),
      getTicketDetail: () =>
        of({
          ticket: { id: 1, type: 'DEV', externalKey: '65010', label: 'Refonte', isCompleted },
          entries: [{ date: '2026-03-10', quantityMinutes: 240, comment: 'A' }],
          totalMinutes: 240,
        }),
      getPublicHolidaysMetropole: () => of({}),
      upsertTimeEntry: () => of(void 0),
      setTicketCompletion: () =>
        of({ id: 1, type: 'DEV', externalKey: '65010', label: 'Refonte', isCompleted: !isCompleted }),
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
    const fixture = setup(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('65010');
  });

  it('does not render date/quantity filter controls', async () => {
    const fixture = setup(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const filters = fixture.nativeElement.querySelector('.new-entry-row');
    expect(filters).toBeNull();
  });

  it('requires month edit action before showing month quantity selectors', async () => {
    const fixture = setup(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.month-chip-list-edit mat-select')).toBeNull();

    const editButton = compiled.querySelector('.month-edit-btn') as HTMLButtonElement | null;
    expect(editButton).not.toBeNull();
    editButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.month-chip-list-edit mat-select')).not.toBeNull();
  });
});

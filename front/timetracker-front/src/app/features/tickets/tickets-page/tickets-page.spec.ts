import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketsPageComponent } from './tickets-page';

describe('TicketsPageComponent', () => {
  it('renders all tickets returned by API', async () => {
    const apiMock = {
      getTickets: () =>
        of([
          { id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket 1' },
          { id: 2, type: 'SUPPORT', externalKey: null, label: null },
        ]),
    };

    await TestBed.configureTestingModule({
      imports: [TicketsPageComponent],
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(TicketsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('.tickets-table');
    expect(table).not.toBeNull();
    expect(compiled.textContent).toContain('ABC-1');
    expect(compiled.textContent).toContain('SUPPORT');
  });

  it('filters tickets by type', async () => {
    const apiMock = {
      getTickets: () =>
        of([
          { id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket 1' },
          { id: 2, type: 'SUPPORT', externalKey: 'SUP-2', label: 'Ticket 2' },
        ]),
    };

    await TestBed.configureTestingModule({
      imports: [TicketsPageComponent],
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(TicketsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.typeFilter.set('support');
    fixture.detectChanges();

    expect(component.filteredTickets().length).toBe(1);
    expect(component.filteredTickets()[0].type).toBe('SUPPORT');
  });
});

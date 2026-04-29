import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TicketLookupComponent } from './ticket-lookup.component';
import { TicketDto } from '../../../../core/api/models';

describe('TicketLookupComponent', () => {
  const tickets: TicketDto[] = [
    { id: 1, type: 'DEV', externalKey: '65010', label: 'Feature login' },
    { id: 2, type: 'DEV', externalKey: '65011', label: 'Fix crash' },
    { id: 3, type: 'SUPPORT', externalKey: 'TKT-99', label: 'Incident réseau' },
  ];

  function setup() {
    TestBed.configureTestingModule({
      imports: [TicketLookupComponent, TranslateModule.forRoot()],
    });
    const fixture = TestBed.createComponent(TicketLookupComponent);
    const component = fixture.componentInstance;
    component.defaultTickets = tickets.slice(0, 2);
    component.searchableTickets = tickets;
    fixture.detectChanges();
    return { component };
  }

  it('filters by ticket number and returns matching ticket', () => {
    const { component } = setup();
    component.query.set('65011');
    expect(component.results().length).toBe(1);
    expect(component.results()[0].id).toBe(2);
  });

  it('shows default tickets when query is empty', () => {
    const { component } = setup();
    component.query.set('');
    const ids = component.results().map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  it('returns empty array when no ticket matches', () => {
    const { component } = setup();
    component.query.set('ZZZZZ');
    expect(component.results().length).toBe(0);
  });

  it('matches ticket regardless of case', () => {
    const { component } = setup();
    component.query.set('tkt');
    const ids = component.results().map((t) => t.id);
    expect(ids).toContain(3);
  });

  it('emits selected ticket and clears query on selection', () => {
    const { component } = setup();
    const emitted: TicketDto[] = [];
    component.ticketSelected.subscribe((t: TicketDto) => emitted.push(t));

    component.onOptionSelected({ option: { value: tickets[0] } } as any);

    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe(1);
    expect(component.query()).toBe('');
  });

  it('respects maxResults limit', () => {
    const { component } = setup();
    component.maxResults = 1;
    component.query.set('6501');
    expect(component.results().length).toBeLessThanOrEqual(1);
  });

  it('prioritises exact match over prefix over contains in search results', () => {
    const { component } = setup();
    component.searchableTickets = [
      { id: 10, type: 'DEV', externalKey: 'A65010B', label: 'Contains' },
      { id: 11, type: 'DEV', externalKey: '65010X', label: 'Starts with' },
      { id: 12, type: 'DEV', externalKey: '65010', label: 'Exact' },
    ];
    component.query.set('65010');
    const ids = component.results().map((t) => t.id);
    expect(ids[0]).toBe(12); // exact match first
  });
});

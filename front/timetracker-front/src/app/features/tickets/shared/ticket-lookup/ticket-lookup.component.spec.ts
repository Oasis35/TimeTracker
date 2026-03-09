import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TicketLookupComponent } from './ticket-lookup.component';

describe('TicketLookupComponent', () => {
  it('filters by ticket number and emits selected ticket', () => {
    TestBed.configureTestingModule({
      imports: [TicketLookupComponent, TranslateModule.forRoot()],
    });

    const fixture = TestBed.createComponent(TicketLookupComponent);
    const component = fixture.componentInstance;
    component.defaultTickets = [
      { id: 1, type: 'DEV', externalKey: '65010', label: 'A', isCompleted: false },
    ];
    component.searchableTickets = [
      { id: 1, type: 'DEV', externalKey: '65010', label: 'A', isCompleted: false },
      { id: 2, type: 'DEV', externalKey: '65011', label: 'B', isCompleted: false },
    ];
    fixture.detectChanges();

    component.query.set('65011');
    fixture.detectChanges();

    const result = component.results();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });
});

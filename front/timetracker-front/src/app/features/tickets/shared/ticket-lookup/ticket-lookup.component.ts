import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { TicketDto } from '../../../../core/api/models';

@Component({
  selector: 'app-ticket-lookup',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './ticket-lookup.component.html',
  styleUrl: './ticket-lookup.component.scss',
})
export class TicketLookupComponent {
  @Input() defaultTickets: TicketDto[] = [];
  @Input() searchableTickets: TicketDto[] = [];
  @Input() maxResults = 8;

  @Output() readonly ticketSelected = new EventEmitter<TicketDto>();

  readonly query = signal<string>('');
  readonly results = computed<TicketDto[]>(() => {
    const query = this.query().trim().toLowerCase();
    const source = query ? this.searchableTickets : this.defaultTickets;
    const deduped = this.distinctById(source)
      .filter((ticket) => !!ticket.externalKey?.trim());

    if (!query) {
      return deduped
        .slice()
        .sort(this.compareByTicketNumber)
        .slice(0, this.maxResults);
    }

    const rank = (ticket: TicketDto): number => {
      const externalKey = (ticket.externalKey ?? '').toLowerCase();
      if (externalKey === query) return 0;
      if (externalKey.startsWith(query)) return 1;
      if (externalKey.includes(query)) return 2;
      if ((ticket.label ?? '').toLowerCase().includes(query)) return 3;
      return 4;
    };

    return deduped
      .filter((ticket) =>
        (ticket.externalKey ?? '').toLowerCase().includes(query) ||
        (ticket.label ?? '').toLowerCase().includes(query)
      )
      .sort((a, b) => rank(a) - rank(b) || this.compareByTicketNumber(a, b))
      .slice(0, this.maxResults);
  });

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.query.set(value);
  }

  clear(): void {
    this.query.set('');
  }

  openPanel(trigger: MatAutocompleteTrigger): void {
    if (!trigger.panelOpen) {
      trigger.openPanel();
    }
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const ticket = event.option.value as TicketDto | null;
    if (!ticket) return;
    this.ticketSelected.emit(ticket);
    this.query.set('');
  }

  displayValue(value: TicketDto | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.externalKey ?? '';
  }

  private compareByTicketNumber(a: TicketDto, b: TicketDto): number {
    return (a.externalKey ?? '').localeCompare(b.externalKey ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private distinctById(tickets: TicketDto[]): TicketDto[] {
    const seen = new Set<number>();
    const result: TicketDto[] = [];
    for (const ticket of tickets) {
      if (seen.has(ticket.id)) continue;
      seen.add(ticket.id);
      result.push(ticket);
    }
    return result;
  }
}

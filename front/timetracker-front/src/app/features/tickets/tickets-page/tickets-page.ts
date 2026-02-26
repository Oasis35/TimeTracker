import { CommonModule } from '@angular/common';
import { Component, computed, resource, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { TicketDto } from '../../../core/api/models';
import { TrackerApi } from '../../../core/api/tracker-api';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-tickets-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './tickets-page.html',
  styleUrl: './tickets-page.scss',
})
export class TicketsPageComponent {
  readonly displayedColumns = ['id', 'type', 'externalKey', 'label'];

  readonly idFilter = signal<string>('');
  readonly typeFilter = signal<string>('');
  readonly externalKeyFilter = signal<string>('');
  readonly labelFilter = signal<string>('');

  readonly ticketsRes = resource<TicketDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getTickets()),
  });

  readonly loading = computed(() => this.ticketsRes.isLoading());

  readonly filteredTickets = computed(() => {
    const tickets = this.ticketsRes.value() ?? [];
    const idFilter = this.idFilter().trim().toLowerCase();
    const typeFilter = this.typeFilter().trim().toLowerCase();
    const externalKeyFilter = this.externalKeyFilter().trim().toLowerCase();
    const labelFilter = this.labelFilter().trim().toLowerCase();

    return tickets.filter((ticket) => {
      const id = ticket.id.toString().toLowerCase();
      const type = (ticket.type ?? '').toLowerCase();
      const externalKey = (ticket.externalKey ?? '').toLowerCase();
      const label = (ticket.label ?? '').toLowerCase();

      return (
        (!idFilter || id.includes(idFilter)) &&
        (!typeFilter || type.includes(typeFilter)) &&
        (!externalKeyFilter || externalKey.includes(externalKeyFilter)) &&
        (!labelFilter || label.includes(labelFilter))
      );
    });
  });

  readonly error = computed(() =>
    this.ticketsRes.error() ? this.i18n.tr('cannot_load_tickets') : null,
  );

  constructor(
    private readonly api: TrackerApi,
    readonly i18n: I18nService,
  ) {}

  onIdFilterInput(event: Event): void {
    this.idFilter.set((event.target as HTMLInputElement).value ?? '');
  }

  onTypeFilterInput(event: Event): void {
    this.typeFilter.set((event.target as HTMLInputElement).value ?? '');
  }

  onExternalKeyFilterInput(event: Event): void {
    this.externalKeyFilter.set((event.target as HTMLInputElement).value ?? '');
  }

  onLabelFilterInput(event: Event): void {
    this.labelFilter.set((event.target as HTMLInputElement).value ?? '');
  }
}

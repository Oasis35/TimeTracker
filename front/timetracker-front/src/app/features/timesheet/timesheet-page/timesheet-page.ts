import { CommonModule } from '@angular/common';
import { Component, computed, effect, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TimesheetMetadataDto, TimesheetMonthDto, TimesheetRowDto, UnitMode } from '../../../core/api/models';

type MonthRequest = { y: number; m: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timesheet-page.html',
  styleUrl: './timesheet-page.css',
})
export class TimesheetPageComponent {
  private readonly now = new Date();
  private readonly todayIso = toIsoDate(this.now);

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
  readonly unitMode = signal<UnitMode>('day');
  readonly selectedDay = signal<string>('');
  readonly ticketTypeOptions = ['DEV', 'SUPPORT', 'CONGES'];

  readonly newTicketType = signal<string>('');
  readonly newTicketExternalKey = signal<string>('');
  readonly newTicketLabel = signal<string>('');

  readonly actionMessage = signal<string>('');
  readonly actionError = signal<string>('');
  readonly busy = signal<boolean>(false);

  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly monthRes = resource<TimesheetMonthDto, MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  readonly loading = computed(() => this.metadataRes.isLoading() || this.monthRes.isLoading());
  readonly title = computed(() => `${this.year()}-${pad2(this.month())}`);
  readonly displayRows = computed<TimesheetRowDto[]>(() => {
    const meta = this.metadataRes.value();
    const month = this.monthRes.value();
    if (!meta || !month) return [];

    const rowsByTicketId = new Map<number, TimesheetRowDto>();
    for (const row of month.rows) {
      rowsByTicketId.set(row.ticketId, row);
    }

    const merged: TimesheetRowDto[] = [];
    for (const ticket of meta.tickets) {
      const existing = rowsByTicketId.get(ticket.id);
      if (existing) {
        merged.push(existing);
      } else {
        merged.push({
          ticketId: ticket.id,
          type: ticket.type,
          externalKey: ticket.externalKey ?? '',
          label: ticket.label ?? '',
          values: {},
          total: 0,
        });
      }
    }

    return merged;
  });

  readonly error = computed(() => {
    const e = this.metadataRes.error() ?? this.monthRes.error();
    return e ? 'Impossible de charger les donnees.' : null;
  });

  constructor(private readonly api: TrackerApi) {
    effect(() => {
      const meta = this.metadataRes.value();
      if (!meta) return;

      if (this.unitMode() !== meta.defaultUnit) {
        this.unitMode.set(meta.defaultUnit);
      }

      if (!this.newTicketType().trim()) {
        const defaultType = (meta.defaultType ?? '').toUpperCase();
        this.newTicketType.set(
          this.ticketTypeOptions.includes(defaultType) ? defaultType : this.ticketTypeOptions[0],
        );
      }
    });

    effect(() => {
      const month = this.monthRes.value();
      if (!month || month.days.length === 0) return;

      const selected = this.selectedDay();
      if (selected && month.days.includes(selected)) return;

      const defaultDay = month.days.includes(this.todayIso) ? this.todayIso : month.days[0];
      this.selectedDay.set(defaultDay);
    });
  }

  prevMonth(): void {
    const m = this.month();
    const y = this.year();

    if (m === 1) {
      this.month.set(12);
      this.year.set(y - 1);
    } else {
      this.month.set(m - 1);
    }
  }

  nextMonth(): void {
    const m = this.month();
    const y = this.year();

    if (m === 12) {
      this.month.set(1);
      this.year.set(y + 1);
    } else {
      this.month.set(m + 1);
    }
  }

  onTicketTypeInput(event: Event): void {
    const value = (event.target as HTMLSelectElement).value ?? '';
    this.newTicketType.set(value);
  }

  onTicketExternalInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.newTicketExternalKey.set(value);
  }

  onTicketLabelInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.newTicketLabel.set(value);
  }

  setSelectedDay(day: string): void {
    this.selectedDay.set(day);
  }

  async addTicket(): Promise<void> {
    const type = this.newTicketType().trim();
    const externalKey = this.newTicketExternalKey().trim();
    const label = this.newTicketLabel().trim();

    this.actionMessage.set('');
    this.actionError.set('');

    if (!type) {
      this.actionError.set('Le type est obligatoire.');
      return;
    }

    if (externalKey && !label) {
      this.actionError.set('Le label est obligatoire si une cle externe est renseignee.');
      return;
    }

    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.createTicket({
          type,
          externalKey: externalKey || null,
          label: label || null,
        }),
      );

      this.newTicketExternalKey.set('');
      this.newTicketLabel.set('');
      this.actionMessage.set('Ticket enregistre.');
      this.metadataRes.reload();
      this.monthRes.reload();
    } catch {
      this.actionError.set('Impossible de creer le ticket.');
    } finally {
      this.busy.set(false);
    }
  }

  async pointDay(ticketId: number, dayFraction: number): Promise<void> {
    const meta = this.metadataRes.value();
    const date = this.selectedDay();

    this.actionMessage.set('');
    this.actionError.set('');

    if (!meta || !date) {
      this.actionError.set('Selectionne un jour avant de pointer.');
      return;
    }

    const quantityMinutes = Math.round(meta.minutesPerDay * dayFraction);

    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.upsertTimeEntry({
          ticketId,
          date,
          quantityMinutes,
          comment: null,
        }),
      );
      this.actionMessage.set('Temps enregistre.');
      this.monthRes.reload();
    } catch {
      this.actionError.set('Impossible de pointer le temps.');
    } finally {
      this.busy.set(false);
    }
  }

  minutesToDisplay(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return '';

    if (this.unitMode() === 'hour') {
      return (minutes / 60).toFixed(2).replace('.', ',');
    }

    return (minutes / meta.minutesPerDay).toFixed(2).replace('.', ',');
  }

  getCellMinutes(row: { values: Record<string, number> }, dayIso: string): number {
    return row.values?.[dayIso] ?? 0;
  }
}

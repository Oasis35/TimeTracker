import { CommonModule } from '@angular/common';
import { Component, computed, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TimesheetMonthDto } from '../../../core/api/models';
import { TrackerApi } from '../../../core/api/tracker-api';
import { I18nService } from '../../../core/services/i18n.service';
import { UnitService } from '../../../core/services/unit.service';
import {
  MonthTicketSummary,
  TicketDayEntry,
  MonthDaySummary,
  createMonthDaySummaries,
  createMonthTicketSummaries,
  calculateMonthTotal,
} from './monthly-utils';

type MonthRequest = { y: number; m: number };

@Component({
  selector: 'app-monthly-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './monthly-page.html',
  styleUrl: './monthly-page.scss',
})
export class MonthlyPageComponent {
  private readonly now = new Date();

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
  readonly ticketFilter = signal<string>('');

  readonly monthRes = resource<TimesheetMonthDto, MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  readonly loading = computed(() => this.monthRes.isLoading());
  readonly error = computed(() => (this.monthRes.error() ? this.i18n.tr('cannot_load_data') : null));

  readonly monthYearLabel = computed(() => {
    const date = new Date(this.year(), this.month() - 1, 1);
    const label = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly monthDays = computed<MonthDaySummary[]>(() => {
    const monthData = this.monthRes.value();
    if (!monthData) return [];
    return createMonthDaySummaries(monthData);
  });

  readonly monthTotalMinutes = computed(() => {
    const totalsByDay = this.monthDays().reduce<Record<string, number>>((totals, day) => {
      totals[day.iso] = day.totalMinutes;
      return totals;
    }, {});
    return calculateMonthTotal(totalsByDay);
  });

  readonly workedDaysCount = computed(() => this.monthDays().filter((day) => day.totalMinutes > 0).length);

  readonly monthTickets = computed<MonthTicketSummary[]>(() => {
    const monthData = this.monthRes.value();
    if (!monthData) return [];
    return createMonthTicketSummaries(monthData);
  });

  readonly filteredMonthTickets = computed<MonthTicketSummary[]>(() => {
    const query = this.ticketFilter().trim().toLowerCase();
    if (!query) return this.monthTickets();
    return this.monthTickets().filter((ticket) => ticket.title.toLowerCase().includes(query));
  });

  constructor(
    private readonly api: TrackerApi,
    private readonly router: Router,
    readonly i18n: I18nService,
    readonly unit: UnitService,
  ) {}

  prevMonth(): void {
    this.shiftMonth(-1);
  }

  nextMonth(): void {
    this.shiftMonth(1);
  }

  jumpToCurrentMonth(): void {
    this.year.set(this.now.getFullYear());
    this.month.set(this.now.getMonth() + 1);
  }

  openDayDetails(dayIso: string): void {
    void this.router.navigate(['/'], { queryParams: { day: dayIso } });
  }

  updateTicketFilter(value: string): void {
    this.ticketFilter.set(value);
  }

  clearTicketFilter(): void {
    this.ticketFilter.set('');
  }

  formatEntryValue(minutes: number): string {
    const monthData = this.monthRes.value();
    const minutesPerDay = monthData?.minutesPerDay ?? 480;

    if (this.unit.unitMode() === 'hour') {
      const value = (minutes / 60).toFixed(2).replace('.', ',');
      return `${value} h`;
    }

    const value = (minutes / minutesPerDay).toFixed(2).replace('.', ',');
    return `${value} j`;
  }

  trackByDayIso(_: number, day: MonthDaySummary): string {
    return day.iso;
  }

  trackByTicket(_: number, ticket: MonthTicketSummary): number {
    return ticket.ticketId;
  }

  trackByTicketEntry(_: number, entry: TicketDayEntry): string {
    return entry.iso;
  }

  private shiftMonth(delta: -1 | 1): void {
    const cursor = new Date(this.year(), this.month() - 1, 1);
    cursor.setMonth(cursor.getMonth() + delta);
    this.year.set(cursor.getFullYear());
    this.month.set(cursor.getMonth() + 1);
  }
}

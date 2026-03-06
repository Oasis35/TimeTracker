import { CommonModule } from '@angular/common';
import { Component, Injectable, OnDestroy, computed, effect, resource, signal } from '@angular/core';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import {
  TicketDto,
  TicketTotalDto,
  TimesheetMetadataDto,
  TimesheetMonthDto,
  TimesheetRowDto,
} from '../../../core/api/models';
import { ActivatedRoute } from '@angular/router';
import {
  TimeEntryDialogComponent,
  TimeEntryDialogData,
} from '../shared/time-entry-dialog/time-entry-dialog.component';

type MonthRequest = { y: number; m: number };
type QuickPickOption = { minutes: number; label: string };
type DisplayRow = TimesheetRowDto & { ticketTotal: number; isCompleted: boolean };

@Injectable()
class IsoMondayDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

const DAY_PAGE_DATE_FORMATS = {
  parse: {
    dateInput: null,
  },
  display: {
    dateInput: {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
    monthYearLabel: {
      month: 'long',
      year: 'numeric',
    },
    dateA11yLabel: {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
    monthYearA11yLabel: {
      month: 'long',
      year: 'numeric',
    },
  },
};

@Component({
  selector: 'app-timesheet-day-page',
  standalone: true,
  imports: [
    CommonModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDividerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatNativeDateModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: DAY_PAGE_DATE_FORMATS },
    { provide: DateAdapter, useClass: IsoMondayDateAdapter },
  ],
  templateUrl: './timesheet-day-page.html',
  styleUrl: './timesheet-day-page.scss',
})
export class TimesheetDayPageComponent implements OnDestroy {
  private readonly now = new Date();
  private readonly todayIso = toIsoDate(this.now);
  private actionMessageTimer: ReturnType<typeof setTimeout> | null = null;

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
  readonly selectedDay = signal<string>('');
  readonly ticketSearchQuery = signal<string>('');

  readonly actionMessage = signal<string>('');
  readonly actionError = signal<string>('');
  readonly busy = signal<boolean>(false);
  readonly language = signal<AppLanguage>('fr');

  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly monthRes = resource<TimesheetMonthDto, MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  readonly usedTicketsRes = resource<TicketDto[], MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getUsedByMonth(params.y, params.m)),
  });

  readonly ticketTotalsRes = resource<TicketTotalDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getTicketTotals()),
  });

  readonly loading = computed(() =>
    this.metadataRes.isLoading() ||
    this.monthRes.isLoading() ||
    this.usedTicketsRes.isLoading() ||
    this.ticketTotalsRes.isLoading(),
  );

  readonly displayRows = computed<DisplayRow[]>(() => {
    const usedTickets = this.usedTicketsRes.value();
    const month = this.monthRes.value();
    const totals = this.ticketTotalsRes.value();
    const selectedDay = this.selectedDay();
    if (!usedTickets || !month) return [];

    const totalsByTicketId = new Map<number, number>();
    for (const row of totals ?? []) {
      totalsByTicketId.set(row.ticketId, row.total);
    }

    const rowsByTicketId = new Map<number, TimesheetRowDto>();
    for (const row of month.rows) {
      rowsByTicketId.set(row.ticketId, row);
    }

    const rows = usedTickets.map((ticket) => {
      const existing = rowsByTicketId.get(ticket.id);
      if (existing) {
        return {
          ...existing,
          ticketTotal: totalsByTicketId.get(ticket.id) ?? 0,
          isCompleted: ticket.isCompleted,
        };
      }

      return {
        ticketId: ticket.id,
        type: ticket.type,
        externalKey: ticket.externalKey ?? '',
        label: ticket.label ?? '',
        values: {},
        ticketTotal: totalsByTicketId.get(ticket.id) ?? 0,
        isCompleted: ticket.isCompleted,
      };
    });

    if (!selectedDay) return [];

    return rows.filter((row) => (row.values?.[selectedDay] ?? 0) > 0);
  });

  readonly error = computed(() => {
    this.language();
    const e = this.metadataRes.error() ?? this.monthRes.error() ?? this.usedTicketsRes.error();
    return e ? this.translate.instant('cannot_load_data') : null;
  });

  readonly selectedDayTotalMinutes = computed<number>(() => {
    const month = this.monthRes.value();
    const day = this.selectedDay();
    if (!month || !day) return 0;
    return month.totalsByDay?.[day] ?? 0;
  });

  readonly monthTotalMinutes = computed<number>(() => {
    const month = this.monthRes.value();
    if (!month) return 0;
    return Object.values(month.totalsByDay ?? {}).reduce((sum, value) => sum + value, 0);
  });

  readonly workedDaysCount = computed<number>(() => {
    const month = this.monthRes.value();
    if (!month) return 0;
    return Object.values(month.totalsByDay ?? {}).filter((value) => value > 0).length;
  });

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];

    const allowed =
      this.unit.unitMode() === 'hour' ? meta.allowedMinutesHourMode : meta.allowedMinutesDayMode;

    return allowed.map((minutes) => ({
      minutes,
      label: this.formatEntryValue(minutes),
    }));
  });
  readonly selectedDateValue = computed<Date | null>(() => {
    const iso = this.selectedDay();
    return iso ? new Date(`${iso}T00:00:00`) : null;
  });
  readonly selectedDayLabel = computed<string>(() => {
    const iso = this.selectedDay();
    if (!iso) return '';
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.dateLocale(), {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  });

  readonly searchResultTickets = computed<TicketDto[]>(() => {
    const query = this.ticketSearchQuery().trim().toLowerCase();
    const compareByTicketNumber = (a: TicketDto, b: TicketDto): number =>
      (a.externalKey ?? '').localeCompare(b.externalKey ?? '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });

    if (!query) {
      const month = this.monthRes.value();
      const usedTickets = this.usedTicketsRes.value() ?? [];
      if (!month) return [];

      const usedById = new Map<number, TicketDto>();
      for (const ticket of usedTickets) {
        usedById.set(ticket.id, ticket);
      }

      const monthTickets = month.rows
        .map((row): TicketDto => {
          const fromUsed = usedById.get(row.ticketId);
          return {
            id: row.ticketId,
            type: fromUsed?.type ?? row.type,
            externalKey: fromUsed?.externalKey ?? row.externalKey,
            label: fromUsed?.label ?? row.label,
            isCompleted: fromUsed?.isCompleted ?? false,
          };
        })
        .filter((ticket) => !ticket.isCompleted && !!(ticket.externalKey ?? '').trim())
        .sort(compareByTicketNumber);

      return monthTickets;
    }

    const allTickets = this.metadataRes.value()?.tickets ?? [];
    const candidates = allTickets.filter((ticket) => !ticket.isCompleted);

    const rank = (ticket: TicketDto): number => {
      const externalKey = (ticket.externalKey ?? '').toLowerCase();
      if (externalKey === query) return 0;
      if (externalKey.startsWith(query)) return 1;
      if (externalKey.includes(query)) return 2;
      return 3;
    };

    return candidates
      .filter((ticket) => (ticket.externalKey ?? '').toLowerCase().includes(query))
      .sort((a, b) => rank(a) - rank(b) || compareByTicketNumber(a, b))
      .slice(0, 8);
  });

  constructor(
    private readonly api: TrackerApi,
    private readonly dialog: MatDialog,
    private readonly dateAdapter: DateAdapter<Date>,
    private readonly translate: TranslateService,
    private readonly route: ActivatedRoute,
    readonly unit: UnitService,
  ) {
    const initial =
      (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
    });
    this.route.queryParamMap.subscribe((params) => {
      const date = params.get('date');
      if (!date) return;
      this.applyRouteDate(date);
    });

    effect(() => {
      this.dateAdapter.setLocale(this.dateLocale());
    });

    effect(() => {
      const month = this.monthRes.value();
      if (!month || month.days.length === 0) return;

      const selected = this.selectedDay();
      if (selected && month.days.includes(selected)) return;

      const firstWeekday = month.days.find((day) => !this.isWeekendIso(day)) ?? month.days[0];
      const defaultDay =
        month.days.includes(this.todayIso) && !this.isWeekendIso(this.todayIso)
          ? this.todayIso
          : firstWeekday;
      this.selectedDay.set(defaultDay);
    });
  }

  setSelectedDay(day: string): void {
    this.selectedDay.set(day);
  }

  onTicketSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.ticketSearchQuery.set(value);
  }

  clearTicketSearch(): void {
    this.ticketSearchQuery.set('');
  }

  openTicketSearchPanel(trigger: MatAutocompleteTrigger): void {
    if (!trigger.panelOpen) {
      trigger.openPanel();
    }
  }

  onTicketSearchOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const ticket = event.option.value as TicketDto | null;
    if (!ticket) return;
    this.openTicketEntryDialog(ticket);
  }

  ticketSearchDisplayValue(value: TicketDto | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.externalKey ?? '';
  }

  ngOnDestroy(): void {
    if (this.actionMessageTimer) {
      clearTimeout(this.actionMessageTimer);
      this.actionMessageTimer = null;
    }
  }

  prevWorkday(): void {
    this.shiftWorkday(-1);
  }

  nextWorkday(): void {
    this.shiftWorkday(1);
  }

  readonly weekdayOnlyFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const iso = toIsoDate(date);
    return !this.isWeekendIso(iso);
  };

  onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;
    if (!date || !this.weekdayOnlyFilter(date)) return;

    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
    this.setSelectedDay(toIsoDate(date));
  }

  private shiftWorkday(delta: -1 | 1): void {
    const startIso = this.selectedDay() || this.todayIso;
    let cursor = new Date(`${startIso}T00:00:00`);

    do {
      cursor.setDate(cursor.getDate() + delta);
    } while (this.isWeekendIso(toIsoDate(cursor)));

    this.year.set(cursor.getFullYear());
    this.month.set(cursor.getMonth() + 1);
    this.setSelectedDay(toIsoDate(cursor));
  }

  private clearActionState(): void {
    this.actionMessage.set('');
    this.actionError.set('');
  }

  openAddTicketDialog(): void {
    const dialogRef = this.dialog.open(AddTicketDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
    });
    dialogRef.afterClosed().subscribe((created) => {
      if (!created) return;
      this.showActionMessage('ticket_saved');
      this.metadataRes.reload();
      this.monthRes.reload();
      this.usedTicketsRes.reload();
      this.ticketTotalsRes.reload();
    });
  }

  async pointMinutes(ticketId: number, quantityMinutes: number): Promise<void> {
    const date = this.selectedDay();

    this.clearActionState();

    if (!date) {
      this.actionError.set(this.translate.instant('day_required_before_log'));
      return;
    }

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
      this.showActionMessage('time_saved');
      this.monthRes.reload();
      this.usedTicketsRes.reload();
      this.ticketTotalsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private isWeekendIso(isoDate: string): boolean {
    const day = new Date(`${isoDate}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }

  formatEntryValue(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return `${minutes} min`;

    if (this.unit.unitMode() === 'hour') {
      const value = (minutes / 60).toFixed(2).replace('.', ',');
      return `${value} h`;
    }

    const value = (minutes / meta.minutesPerDay).toFixed(2).replace('.', ',');
    return `${value} j`;
  }

  getCellMinutes(row: { values: Record<string, number> }, dayIso: string): number {
    return row.values?.[dayIso] ?? 0;
  }

  openTicketEntryDialog(ticket: TicketDto): void {
    if (ticket.isCompleted) {
      return;
    }

    const date = this.selectedDay();
    if (!date) {
      this.actionError.set(this.translate.instant('day_required_before_log'));
      return;
    }

    const currentMinutes = this.getTicketMinutesForDay(ticket.id, date);
    const data: TimeEntryDialogData = {
      ticketId: ticket.id,
      ticketRef: `${ticket.type} ${ticket.externalKey ?? ''}`.trim(),
      ticketLabel: ticket.label ?? '',
      dayLabel: this.selectedDayLabel(),
      currentMinutes,
      options: this.quickPickOptions(),
    };

    const dialogRef = this.dialog.open(TimeEntryDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });

    this.clearTicketSearch();
    dialogRef.afterClosed().subscribe((minutes) => {
      if (typeof minutes !== 'number' || Number.isNaN(minutes)) return;
      void this.pointMinutes(ticket.id, minutes);
    });
  }

  private showActionMessage(key: string): void {
    if (this.actionMessageTimer) {
      clearTimeout(this.actionMessageTimer);
    }
    this.actionMessage.set(this.translate.instant(key));
    this.actionMessageTimer = setTimeout(() => {
      this.actionMessage.set('');
      this.actionMessageTimer = null;
    }, 2400);
  }

  private dateLocale(): string {
    return this.language() === 'fr' ? 'fr-FR' : 'en-US';
  }

  private getTicketMinutesForDay(ticketId: number, dayIso: string): number {
    const month = this.monthRes.value();
    const row = month?.rows.find((candidate) => candidate.ticketId === ticketId);
    return row?.values?.[dayIso] ?? 0;
  }

  private applyRouteDate(dateIso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
    const date = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
    this.selectedDay.set(dateIso);
  }
}


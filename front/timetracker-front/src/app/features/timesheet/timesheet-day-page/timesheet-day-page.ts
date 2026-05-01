import { CommonModule } from '@angular/common';
import { TicketExtLinkComponent } from '../../../shared/ticket-ext-link/ticket-ext-link.component';
import { Component, DestroyRef, Injectable, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';
import { PublicHolidaysService } from '../../../core/services/public-holidays.service';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { isWeekendIso, toIsoDate } from '../../../core/utils/date-helpers';
import { formatMinutes } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import {
  TicketDto,
  TicketTotalDto,
  TicketType,
  TimesheetMetadataDto,
  TimesheetMonthDto,
  TimesheetRowDto,
} from '../../../core/api/models';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  TimeSlotPickerDialogComponent,
  TimeSlotPickerDialogData,
  TimeSlotPickerDialogResult,
} from '../shared/time-slot-picker-dialog/time-slot-picker-dialog.component';
import { LogTimeDialogComponent, LogTimeDialogData, LogTimeDialogResult } from '../shared/log-time-dialog/log-time-dialog.component';


type MonthRequest = { y: number; m: number };
type DisplayRow = TimesheetRowDto & { ticketTotal: number };

export interface PrevDayTicket {
  ticketId: number;
  type: TicketType;
  externalKey: string;
  label: string;
}

@Injectable()
class IsoMondayDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
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
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    TicketExtLinkComponent,
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
export class TimesheetDayPageComponent {
  private readonly now = new Date();
  private readonly todayIso = toIsoDate(this.now);

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
  readonly selectedDay = signal<string>('');

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

  readonly drawerOpen = signal<boolean>(false);

  private prevDayRequest = computed<MonthRequest | null>(() => {
    const iso = this.selectedDay();
    if (!iso) return null;
    const holidays = this.publicHolidays.holidays() ?? {};
    let cursor = new Date(`${iso}T00:00:00`);
    do { cursor.setDate(cursor.getDate() - 1); }
    while (isWeekendIso(toIsoDate(cursor)) || toIsoDate(cursor) in holidays);
    const prev = toIsoDate(cursor);
    return { y: parseInt(prev.slice(0, 4), 10), m: parseInt(prev.slice(5, 7), 10) };
  });

  private readonly prevMonthRes = resource<TimesheetMonthDto | null, MonthRequest | null>({
    params: () => this.prevDayRequest(),
    loader: ({ params }) =>
      params ? firstValueFrom(this.api.getMonth(params.y, params.m)) : Promise.resolve(null),
  });

  readonly prevDayMissingTickets = computed<PrevDayTicket[]>(() => {
    const iso = this.selectedDay();
    if (!iso) return [];
    const req = this.prevDayRequest();
    if (!req) return [];
    const holidays = this.publicHolidays.holidays() ?? {};
    let cursor = new Date(`${iso}T00:00:00`);
    do { cursor.setDate(cursor.getDate() - 1); }
    while (isWeekendIso(toIsoDate(cursor)) || toIsoDate(cursor) in holidays);
    const prevIso = toIsoDate(cursor);

    const prevMonth = this.prevMonthRes.value();
    if (!prevMonth) return [];

    const currentTicketIds = new Set(this.displayRows().map((r) => r.ticketId));
    const result: PrevDayTicket[] = [];
    for (const row of prevMonth.rows) {
      if (currentTicketIds.has(row.ticketId)) continue;
      if ((row.values?.[prevIso] ?? 0) === 0) continue;
      result.push({ ticketId: row.ticketId, type: row.type, externalKey: row.externalKey, label: row.label });
    }
    return result;
  });

  toggleDrawer(): void {
    this.drawerOpen.set(!this.drawerOpen());
  }

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
        };
      }

      return {
        ticketId: ticket.id,
        type: ticket.type,
        externalKey: ticket.externalKey ?? '',
        label: ticket.label ?? '',
        values: {},
        ticketTotal: totalsByTicketId.get(ticket.id) ?? 0,
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

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];
    return buildQuickPickOptions(meta, this.unit.unitMode());
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

  readonly daySearchDefaultTickets = computed<TicketDto[]>(() => {
    const month = this.monthRes.value();
    const usedTickets = this.usedTicketsRes.value() ?? [];
    if (!month) return [];

    const usedById = new Map<number, TicketDto>();
    for (const ticket of usedTickets) {
      usedById.set(ticket.id, ticket);
    }

    return month.rows
      .map((row): TicketDto => {
        const fromUsed = usedById.get(row.ticketId);
        return {
          id: row.ticketId,
          type: fromUsed?.type ?? row.type,
          externalKey: fromUsed?.externalKey ?? row.externalKey,
          label: fromUsed?.label ?? row.label,
        };
      })
      .filter((ticket) => !!(ticket.externalKey ?? '').trim());
  });
  readonly daySearchAllTickets = computed<TicketDto[]>(() =>
    (this.metadataRes.value()?.tickets ?? []).filter(
      (ticket) => !!(ticket.externalKey ?? '').trim(),
    ),
  );

  constructor(
    private readonly api: TrackerApi,
    private readonly dialog: MatDialog,
    private readonly dateAdapter: DateAdapter<Date>,
    private readonly translate: TranslateService,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly unit: UnitService,
    readonly publicHolidays: PublicHolidaysService,
  ) {
    const destroyRef = inject(DestroyRef);
    void publicHolidays.load();
    const initial =
      (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const date = params.get('date');
      if (!date) return;
      untracked(() => this.applyRouteDate(date));
    });
    effect(() => {
      const date = this.selectedDay();
      if (!date) return;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { date },
        replaceUrl: true,
      });
    });

    effect(() => {
      this.dateAdapter.setLocale(this.dateLocale());
    });

    effect(() => {
      const month = this.monthRes.value();
      if (!month || month.days.length === 0) return;

      const selected = this.selectedDay();
      if (selected && month.days.includes(selected)) return;

      const firstWeekday = month.days.find((day) => !isWeekendIso(day)) ?? month.days[0];
      const defaultDay =
        month.days.includes(this.todayIso) && !isWeekendIso(this.todayIso)
          ? this.todayIso
          : firstWeekday;
      this.selectedDay.set(defaultDay);
    });

  }

  setSelectedDay(day: string): void {
    this.selectedDay.set(day);
  }

  onTicketLookupSelected(ticket: TicketDto): void {
    this.openTicketEntryDialog(ticket);
  }

  prevWorkday(): void {
    this.shiftWorkday(-1);
  }

  nextWorkday(): void {
    this.shiftWorkday(1);
  }

  readonly weekdayOnlyFilter = (date: Date | null): boolean => {
    if (!date) return false;
    return !isWeekendIso(toIsoDate(date));
  };

  isToday(): boolean {
    return this.selectedDay() === this.todayIso;
  }

  goToToday(): void {
    this.year.set(this.now.getFullYear());
    this.month.set(this.now.getMonth() + 1);
    this.setSelectedDay(this.todayIso);
  }

  onDateInputSelected(date: Date | null): void {
    if (!date || !this.weekdayOnlyFilter(date)) return;
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
    this.setSelectedDay(toIsoDate(date));
  }

  private shiftWorkday(delta: -1 | 1): void {
    const startIso = this.selectedDay() || this.todayIso;
    const holidays = this.publicHolidays.holidays() ?? {};
    let cursor = new Date(`${startIso}T00:00:00`);

    do {
      cursor.setDate(cursor.getDate() + delta);
    } while (isWeekendIso(toIsoDate(cursor)) || toIsoDate(cursor) in holidays);

    this.year.set(cursor.getFullYear());
    this.month.set(cursor.getMonth() + 1);
    this.setSelectedDay(toIsoDate(cursor));
  }

  private clearActionState(): void {
    this.actionError.set('');
  }

  openLogTimeDialogForDay(): void {
    const iso = this.selectedDay();
    const day = iso ? new Date(`${iso}T00:00:00`) : new Date();
    const data: LogTimeDialogData = {
      year: this.year(),
      month: this.month(),
      defaultTickets: this.usedTicketsRes.value() ?? [],
      allTickets: this.metadataRes.value()?.tickets ?? [],
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      publicHolidays: this.publicHolidays.holidays() ?? {},
      preselectedDate: day,
      minDate: day,
      maxDate: day,
    };
    this.dialog.open(LogTimeDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((result: LogTimeDialogResult | undefined) => {
        if (!result) return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: result.ticketId, date: result.date, quantityMinutes: result.minutes }),
        ).then(() => {
          this.showActionMessage('time_saved');
          this.monthRes.reload();
          this.usedTicketsRes.reload();
          this.ticketTotalsRes.reload();
        }).catch((error: unknown) => {
          this.actionError.set(this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
        });
      });
  }

  openAddTicketDialog(): void {
    const dialogRef = this.dialog.open(AddTicketDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.showActionMessage('ticket_saved');
      this.metadataRes.reload();
      this.monthRes.reload();
      this.usedTicketsRes.reload();
      this.ticketTotalsRes.reload();
      if (result.logTime) {
        this.openTicketEntryDialog(result.ticket, { withDatePicker: true });
      }
    });
  }

  async pointMinutes(ticketId: number, quantityMinutes: number, dateOverride?: string): Promise<void> {
    const date = dateOverride ?? this.selectedDay();

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

  formatEntryValue(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return `${minutes} min`;
    return formatMinutes(minutes, meta.minutesPerDay, this.unit.unitMode());
  }

  getCellMinutes(row: { values: Record<string, number> }, dayIso: string): number {
    return row.values?.[dayIso] ?? 0;
  }

  openTicketEntryDialog(ticket: TicketDto, opts?: { withDatePicker?: boolean }): void {
    const date = this.selectedDay();
    if (!date && !opts?.withDatePicker) {
      this.actionError.set(this.translate.instant('day_required_before_log'));
      return;
    }

    const currentMinutes = date ? this.getTicketMinutesForDay(ticket.id, date) : 0;
    const data: TimeSlotPickerDialogData = {
      ticketId: ticket.id,
      ticketRef: `${ticket.type} ${ticket.externalKey ?? ''}`.trim(),
      ticketLabel: ticket.label ?? '',
      dayLabel: this.selectedDayLabel(),
      currentMinutes,
      options: this.quickPickOptions(),
      ...(opts?.withDatePicker ? { initialDate: date ?? toIsoDate(new Date()), dateLocale: this.dateLocale() } : {}),
    };

    const dialogRef = this.dialog.open(TimeSlotPickerDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });

    dialogRef.afterClosed().subscribe((result: TimeSlotPickerDialogResult | undefined) => {
      if (result === undefined || result === null) return;
      if (typeof result === 'number') {
        if (Number.isNaN(result)) return;
        void this.pointMinutes(ticket.id, result);
      } else {
        void this.pointMinutes(ticket.id, result.minutes, result.date);
      }
    });
  }

  openPrevDayTicketDialog(ticket: PrevDayTicket): void {
    const iso = this.selectedDay();
    const day = iso ? new Date(`${iso}T00:00:00`) : new Date();
    const ticketDto: TicketDto = { id: ticket.ticketId, type: ticket.type, externalKey: ticket.externalKey, label: ticket.label };
    const data: LogTimeDialogData = {
      year: this.year(),
      month: this.month(),
      defaultTickets: [ticketDto],
      allTickets: this.metadataRes.value()?.tickets ?? [],
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      publicHolidays: this.publicHolidays.holidays() ?? {},
      preselectedTicket: ticketDto,
      preselectedDate: day,
      minDate: day,
      maxDate: day,
    };
    this.dialog.open(LogTimeDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((result: LogTimeDialogResult | undefined) => {
        if (!result) return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: result.ticketId, date: result.date, quantityMinutes: result.minutes }),
        ).then(() => {
          this.showActionMessage('time_saved');
          this.monthRes.reload();
          this.usedTicketsRes.reload();
          this.ticketTotalsRes.reload();
        }).catch((error: unknown) => {
          this.actionError.set(this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
        });
      });
  }

  private showActionMessage(key: string): void {
    showSnack(this.snackBar, this.translate.instant(key));
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

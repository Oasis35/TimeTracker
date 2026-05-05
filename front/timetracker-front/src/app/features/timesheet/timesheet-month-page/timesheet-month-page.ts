import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { PublicHolidaysService } from '../../../core/services/public-holidays.service';
import { TimesheetCacheService } from '../../../core/services/timesheet-cache.service';
import { TicketDto, TimesheetMonthDto, TimesheetRowDto } from '../../../core/api/models';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { isWeekendIso, isoWeekNumber, isoWeekYear } from '../../../core/utils/date-helpers';
import { formatNumberTrimmed } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { TimeSlotPickerDialogComponent, TimeSlotPickerDialogData, TimeSlotPickerDialogResult } from '../shared/time-slot-picker-dialog/time-slot-picker-dialog.component';
import { LogTimeDialogComponent, LogTimeDialogData, LogTimeDialogResult } from '../shared/log-time-dialog/log-time-dialog.component';
import { ExternalLinkService } from '../../../core/services/external-link.service';

type MonthRequest = { y: number; m: number };

type MonthlyRow = TimesheetRowDto & { total: number };

@Component({
  selector: 'app-timesheet-month-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    TranslateModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'fr-FR' }],
  templateUrl: './timesheet-month-page.html',
  styleUrl: './timesheet-month-page.scss',
})
export class TimesheetMonthPageComponent {
  private readonly cache = inject(TimesheetCacheService);
  private readonly api = inject(TrackerApi);
  private readonly translate = inject(TranslateService);
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly unit = inject(UnitService);
  private readonly extLinkService = inject(ExternalLinkService);
  readonly publicHolidays = inject(PublicHolidaysService);

  private now(): Date { return new Date(); }

  readonly year = signal<number>(this.now().getFullYear());
  readonly month = signal<number>(this.now().getMonth() + 1);
  readonly language = signal<AppLanguage>('fr');

  readonly metadataRes = this.cache.metadataRes;
  readonly monthRes = resource<TimesheetMonthDto, MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });
  readonly usedTicketsRes = resource<TicketDto[], MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getUsedByMonth(params.y, params.m)),
  });
  readonly allTicketsRes = resource<TicketDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getAllTickets()),
  });

  readonly allTimeTotalsRes = this.cache.ticketTotalsRes;
  readonly allTimeTotalsMap = computed(() => {
    const totals = this.allTimeTotalsRes.value() ?? [];
    return new Map(totals.map((t) => [t.ticketId, t.total]));
  });

  readonly prevMonthRequest = computed<MonthRequest>(() => {
    const d = new Date(this.year(), this.month() - 2, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });

  readonly prevMonthLabel = computed(() => {
    const { y, m } = this.prevMonthRequest();
    const date = new Date(y, m - 1, 1);
    const label = new Intl.DateTimeFormat(this.dateLocale(), { month: 'long', year: '2-digit' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  private readonly prevMonthRes = resource<TimesheetMonthDto, MonthRequest>({
    params: () => this.prevMonthRequest(),
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  readonly prevMonthMissingRows = computed<{ ticketId: number; type: string; externalKey: string; label: string }[]>(() => {
    const prev = this.prevMonthRes.value();
    if (!prev) return [];
    const currentIds = new Set(this.rows().map((r) => r.ticketId));
    return prev.rows
      .filter((r) => !currentIds.has(r.ticketId) && Object.values(r.values ?? {}).some((v) => v > 0))
      .map((r) => ({ ticketId: r.ticketId, type: r.type, externalKey: r.externalKey ?? '', label: r.label ?? '' }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.externalKey.localeCompare(b.externalKey));
  });

  readonly drawerOpen = signal<boolean>(false);

  private drawerCacheKey(): string {
    return `tt-prev-month-drawer-${this.year()}-${this.month()}`;
  }

  toggleDrawer(): void {
    const next = !this.drawerOpen();
    this.drawerOpen.set(next);
    localStorage.setItem(this.drawerCacheKey(), next ? '1' : '0');
  }

  openPrevMonthTicketDialog(row: { ticketId: number; type: string; externalKey: string; label: string }): void {
    const ticket: TicketDto = { id: row.ticketId, type: row.type as TicketDto['type'], externalKey: row.externalKey, label: row.label };
    const data: LogTimeDialogData = {
      year: this.year(),
      month: this.month(),
      defaultTickets: [ticket],
      allTickets: this.allTicketsRes.value() ?? [],
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      publicHolidays: this.publicHolidays.holidays() ?? {},
      preselectedTicket: ticket,
    };
    this.dialog.open(LogTimeDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((result: LogTimeDialogResult | undefined) => {
        if (!result) return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: result.ticketId, date: result.date, quantityMinutes: result.minutes }),
        ).then(() => {
          showSnack(this.snackBar, this.translate.instant('time_saved'));
          this.monthRes.reload();
          this.usedTicketsRes.reload();
          this.cache.invalidateTotals();
        }).catch((error: unknown) => {
          showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
        });
      });
  }

  readonly loading = computed(
    () => this.metadataRes.isLoading() || this.monthRes.isLoading() || this.usedTicketsRes.isLoading(),
  );
  readonly error = computed(() => {
    this.language();
    if (this.metadataRes.error() || this.monthRes.error() || this.usedTicketsRes.error()) {
      return this.translate.instant('cannot_load_data');
    }
    return null;
  });

  readonly days = computed<string[]>(() => this.monthRes.value()?.days ?? []);
  readonly rows = computed<MonthlyRow[]>(() => {
    const month = this.monthRes.value();
    const tickets = this.usedTicketsRes.value();
    if (!month || !tickets) return [];

    const rowsByTicketId = new Map<number, TimesheetRowDto>();
    for (const row of month.rows) {
      rowsByTicketId.set(row.ticketId, row);
    }

    return tickets.map((ticket) => {
      const row = rowsByTicketId.get(ticket.id) ?? {
        ticketId: ticket.id,
        type: ticket.type,
        externalKey: ticket.externalKey ?? '',
        label: ticket.label ?? '',
        values: {},
      };
      const total = Object.values(row.values ?? {}).reduce((sum, value) => sum + value, 0);
      return { ...row, total };
    });
  });

  readonly monthYearLabel = computed(() => {
    const date = new Date(this.year(), this.month() - 1, 1);
    const label = new Intl.DateTimeFormat(this.dateLocale(), { month: 'long', year: 'numeric' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  readonly selectedMonthDate = computed(() => new Date(this.year(), this.month() - 1, 1));
  readonly isCurrentMonth = computed(() => {
    const n = this.now();
    return this.year() === n.getFullYear() && this.month() === n.getMonth() + 1;
  });
  readonly monthTotal = computed(() => this.rows().reduce((sum, row) => sum + row.total, 0));

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];
    return buildQuickPickOptions(meta, this.unit.unitMode());
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    void this.publicHolidays.load();
    const initial = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
    });
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.dateAdapter.setLocale(this.dateLocale());
    });
    this.dateAdapter.setLocale(this.dateLocale());
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const year = Number(params.get('year'));
      const month = Number(params.get('month'));
      if (!Number.isInteger(year) || !Number.isInteger(month)) return;
      if (month < 1 || month > 12) return;
      if (year < 1900 || year > 3000) return;
      untracked(() => {
        this.year.set(year);
        this.month.set(month);
      });
    });
    effect(() => {
      const year = this.year();
      const month = this.month();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { year, month },
        replaceUrl: true,
      });
    });

    effect(() => {
      const key = `tt-prev-month-drawer-${this.year()}-${this.month()}`;
      untracked(() => this.drawerOpen.set(localStorage.getItem(key) === '1'));
    });
  }

  onMonthSelected(date: Date, picker: MatDatepicker<Date>): void {
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
    picker.close();
  }

  prevMonth(): void {
    this.shiftMonth(-1);
  }

  nextMonth(): void {
    this.shiftMonth(1);
  }

  goToCurrentMonth(): void {
    const n = this.now();
    this.year.set(n.getFullYear());
    this.month.set(n.getMonth() + 1);
  }

  readonly weekBlocks = computed<{ week: number; weekYear: number; span: number; startIndex: number }[]>(() => {
    const days = this.days();
    const blocks: { week: number; weekYear: number; span: number; startIndex: number }[] = [];
    let current: { week: number; weekYear: number; span: number; startIndex: number } | null = null;
    for (let i = 0; i < days.length; i++) {
      const w = isoWeekNumber(days[i]);
      const wy = isoWeekYear(days[i]);
      if (!current || current.week !== w) {
        current = { week: w, weekYear: wy, span: 1, startIndex: i };
        blocks.push(current);
      } else {
        current.span++;
      }
    }
    return blocks;
  });

  dayLabel(dayIso: string): string {
    return dayIso.slice(-2);
  }

  isWeekendIso(dayIso: string): boolean {
    return isWeekendIso(dayIso);
  }

  isHolidayIso(dayIso: string): boolean {
    return !!this.publicHolidays.holidays()?.[dayIso];
  }

  holidayLabel(dayIso: string): string {
    return this.publicHolidays.holidays()?.[dayIso] ?? '';
  }

  isSundayIso(dayIso: string): boolean {
    return new Date(`${dayIso}T00:00:00`).getDay() === 0;
  }

  isAlternateWeekBlock(dayIndex: number): boolean {
    const days = this.days();
    if (dayIndex >= days.length) return false;
    return isoWeekNumber(days[dayIndex]) % 2 === 1;
  }

  buildExtUrl(externalKey: string): string {
    return this.extLinkService.buildUrl(externalKey);
  }

  getCellMinutes(row: MonthlyRow, dayIso: string): number {
    return row.values?.[dayIso] ?? 0;
  }

  formatValue(minutes: number): string {
    const metadata = this.metadataRes.value();
    if (!metadata) return '0';
    if (this.unit.unitMode() === 'hour') {
      return formatNumberTrimmed(minutes / 60);
    }
    return formatNumberTrimmed(minutes / metadata.minutesPerDay);
  }

  formatZeroAware(minutes: number): string {
    return minutes === 0 ? '0' : this.formatValue(minutes);
  }

  openAddTicketDialog(): void {
    const dialogRef = this.dialog.open(AddTicketDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      showSnack(this.snackBar, this.translate.instant('ticket_saved'));
      this.cache.invalidate();
      this.monthRes.reload();
      this.usedTicketsRes.reload();
      if (result.logTime) {
        this.openTicketEntryDialog(result.ticket);
      }
    });
  }

  openLogTimeDialog(): void {
    const data: LogTimeDialogData = {
      year: this.year(),
      month: this.month(),
      defaultTickets: this.usedTicketsRes.value() ?? [],
      allTickets: this.allTicketsRes.value() ?? [],
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      publicHolidays: this.publicHolidays.holidays() ?? {},
    };
    const dialogRef = this.dialog.open(LogTimeDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });
    dialogRef.afterClosed().subscribe((result: LogTimeDialogResult | undefined) => {
      if (!result) return;
      void firstValueFrom(
        this.api.upsertTimeEntry({ ticketId: result.ticketId, date: result.date, quantityMinutes: result.minutes }),
      ).then(() => {
        showSnack(this.snackBar, this.translate.instant('time_saved'));
        this.monthRes.reload();
        this.usedTicketsRes.reload();
        this.cache.invalidateTotals();
      }).catch((error: unknown) => {
        showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
      });
    });
  }

  onCellClick(row: MonthlyRow, day: string): void {
    if (isWeekendIso(day) || this.isHolidayIso(day)) return;
    this.openTicketDayDialog(row.ticketId, `${row.type} ${row.externalKey ?? ''}`.trim(), row.label ?? '', day, this.getCellMinutes(row, day));
  }

  private openTicketEntryDialog(ticket: TicketDto): void {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.openTicketDayDialog(ticket.id, `${ticket.type} ${ticket.externalKey ?? ''}`.trim(), ticket.label ?? '', todayIso, 0, { withDatePicker: true });
  }

  private openTicketDayDialog(ticketId: number, ticketRef: string, ticketLabel: string, dateIso: string, currentMinutes: number, opts?: { withDatePicker?: boolean }): void {
    const data: TimeSlotPickerDialogData = {
      ticketId,
      ticketRef,
      ticketLabel,
      dayLabel: '',
      currentMinutes,
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      ...(opts?.withDatePicker ? { initialDate: dateIso } : { readonlyDate: dateIso }),
    };

    const dialogRef = this.dialog.open(TimeSlotPickerDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });

    dialogRef.afterClosed().subscribe((result: TimeSlotPickerDialogResult | undefined) => {
      if (result === undefined || result === null) return;
      const resolvedDate = typeof result === 'number' ? dateIso : result.date;
      const resolvedMinutes = typeof result === 'number' ? result : result.minutes;
      if (typeof result === 'number' && Number.isNaN(result)) return;
      void firstValueFrom(
        this.api.upsertTimeEntry({ ticketId, date: resolvedDate, quantityMinutes: resolvedMinutes }),
      ).then(() => {
        this.monthRes.reload();
        this.usedTicketsRes.reload();
        this.cache.invalidateTotals();
      }).catch((error: unknown) => {
        showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
      });
    });
  }

  private shiftMonth(delta: -1 | 1): void {
    const date = new Date(this.year(), this.month() - 1, 1);
    date.setMonth(date.getMonth() + delta);
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
  }

  private dateLocale(): string {
    return this.language() === 'fr' ? 'fr-FR' : 'en-US';
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, Injectable, resource, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TrackerApi } from '../../../core/api/tracker-api';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { PublicHolidaysService } from '../../../core/services/public-holidays.service';
import { TicketDto, TicketTotalDto, TicketType, TimesheetMetadataDto, TimesheetMonthDto } from '../../../core/api/models';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { ExternalLinkService } from '../../../core/services/external-link.service';
import { isWeekendIso, isoWeekDays, isoWeekNumber, isoWeekYear, monthsForDays, toIsoDate } from '../../../core/utils/date-helpers';
import { formatNumberTrimmed } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import { TimeSlotPickerDialogComponent, TimeSlotPickerDialogData, TimeSlotPickerDialogResult } from '../shared/time-slot-picker-dialog/time-slot-picker-dialog.component';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { TicketExtLinkComponent } from '../../../shared/ticket-ext-link/ticket-ext-link.component';
import { LogTimeDialogComponent, LogTimeDialogData, LogTimeDialogResult } from '../shared/log-time-dialog/log-time-dialog.component';

@Injectable()
class IsoMondayDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number { return 1; }
}

type MonthKey = { y: number; m: number };

export interface WeekTicketCol {
  ticketId: number;
  type: TicketType;
  externalKey: string;
  label: string;
}

export interface WeekDayRow {
  iso: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayLabel: string;
  dayLabel: string;
  total: number;
  values: Map<number, number>; // ticketId → minutes
}

@Component({
  selector: 'app-timesheet-week-page',
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
    TicketExtLinkComponent,
    TranslateModule,
  ],
  templateUrl: './timesheet-week-page.html',
  styleUrl: './timesheet-week-page.scss',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: DateAdapter, useClass: IsoMondayDateAdapter },
  ],
})
export class TimesheetWeekPageComponent {
  private readonly now = new Date();

  private readonly api = inject(TrackerApi);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly unit = inject(UnitService);
  private readonly extLinkService = inject(ExternalLinkService);
  readonly publicHolidays = inject(PublicHolidaysService);

  readonly isoWeek = signal<number>(isoWeekNumber(this.todayIso()));
  readonly weekYear = signal<number>(isoWeekYear(this.todayIso()));
  readonly language = signal<AppLanguage>('fr');

  readonly prevIsoWeek = computed(() => {
    const w = this.isoWeek();
    return w > 1 ? w - 1 : 52;
  });

  readonly drawerOpen = signal<boolean>(false);

  private drawerCacheKey(): string {
    return `tt-prev-week-drawer-${this.weekYear()}-${this.isoWeek()}`;
  }

  toggleDrawer(): void {
    const next = !this.drawerOpen();
    this.drawerOpen.set(next);
    localStorage.setItem(this.drawerCacheKey(), next ? '1' : '0');
  }

  readonly selectedWeekDate = computed(() => {
    const days = isoWeekDays(this.weekYear(), this.isoWeek());
    return new Date(`${days[0]}T00:00:00`);
  });

  readonly pickerDateFilter = computed(() => {
    const holidays = this.publicHolidays.holidays() ?? {};
    return (date: Date | null): boolean => {
      if (!date) return false;
      const iso = toIsoDate(date);
      return !isWeekendIso(iso) && !holidays[iso];
    };
  });

  readonly days = computed<string[]>(() => isoWeekDays(this.weekYear(), this.isoWeek()));

  private readonly monthsNeeded = computed<MonthKey[]>(() => monthsForDays(this.days()));

  private readonly month1Res = resource<TimesheetMonthDto, MonthKey>({
    params: () => this.monthsNeeded()[0] ?? { y: this.weekYear(), m: 1 },
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  private readonly month2Res = resource<TimesheetMonthDto | null, MonthKey | null>({
    params: () => this.monthsNeeded()[1] ?? null,
    loader: ({ params }) =>
      params ? firstValueFrom(this.api.getMonth(params.y, params.m)) : Promise.resolve(null),
  });

  readonly prevWeekDays = computed<string[]>(() => {
    const monday = this.days()[0];
    const prev = new Date(`${monday}T00:00:00`);
    prev.setDate(prev.getDate() - 7);
    return isoWeekDays(isoWeekYear(toIsoDate(prev)), isoWeekNumber(toIsoDate(prev)));
  });

  private readonly prevMonthsNeeded = computed<MonthKey[]>(() => monthsForDays(this.prevWeekDays()));

  private readonly prevMonth1Res = resource<TimesheetMonthDto, MonthKey>({
    params: () => this.prevMonthsNeeded()[0] ?? { y: this.weekYear(), m: 1 },
    loader: ({ params }) => firstValueFrom(this.api.getMonth(params.y, params.m)),
  });

  private readonly prevMonth2Res = resource<TimesheetMonthDto | null, MonthKey | null>({
    params: () => this.prevMonthsNeeded()[1] ?? null,
    loader: ({ params }) =>
      params ? firstValueFrom(this.api.getMonth(params.y, params.m)) : Promise.resolve(null),
  });

  readonly prevWeekMissingCols = computed<WeekTicketCol[]>(() => {
    const prevDays = this.prevWeekDays();
    const prevMonths = [this.prevMonth1Res.value(), this.prevMonth2Res.value()].filter(Boolean) as TimesheetMonthDto[];
    const currentTicketIds = new Set(this.ticketCols().map((c) => c.ticketId));
    const map = new Map<number, WeekTicketCol>();
    for (const month of prevMonths) {
      for (const row of month.rows) {
        if (map.has(row.ticketId)) continue;
        if (currentTicketIds.has(row.ticketId)) continue;
        const hasEntry = prevDays.some((d) => (row.values[d] ?? 0) > 0);
        if (hasEntry) {
          map.set(row.ticketId, {
            ticketId: row.ticketId,
            type: row.type,
            externalKey: row.externalKey,
            label: row.label,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) =>
      a.type.localeCompare(b.type) || (a.externalKey ?? '').localeCompare(b.externalKey ?? ''),
    );
  });

  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly allTicketsRes = resource<TicketDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getAllTickets()),
  });

  readonly allTimeTotalsRes = resource<TicketTotalDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getTicketTotals()),
  });

  readonly allTimeTotalsMap = computed(() => {
    const totals = this.allTimeTotalsRes.value() ?? [];
    return new Map(totals.map((t) => [t.ticketId, t.total]));
  });


  readonly loading = computed(
    () => this.metadataRes.isLoading() || this.month1Res.isLoading() || this.month2Res.isLoading(),
  );

  readonly error = computed(() => {
    this.language();
    if (this.metadataRes.error() || this.month1Res.error() || this.month2Res.error()) {
      return this.translate.instant('cannot_load_data');
    }
    return null;
  });

  // Ticket columns — all tickets that have at least one entry this week
  readonly ticketCols = computed<WeekTicketCol[]>(() => {
    const days = this.days();
    const months = [this.month1Res.value(), this.month2Res.value()].filter(Boolean) as TimesheetMonthDto[];
    const map = new Map<number, WeekTicketCol>();
    for (const month of months) {
      for (const row of month.rows) {
        if (map.has(row.ticketId)) continue;
        const hasEntry = days.some((d) => (row.values[d] ?? 0) > 0);
        if (hasEntry) {
          map.set(row.ticketId, {
            ticketId: row.ticketId,
            type: row.type,
            externalKey: row.externalKey,
            label: row.label,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) =>
      a.type.localeCompare(b.type) || (a.externalKey ?? '').localeCompare(b.externalKey ?? ''),
    );
  });

  // Row per day with values per ticket
  readonly dayRows = computed<WeekDayRow[]>(() => {
    const days = this.days();
    const cols = this.ticketCols();
    const months = [this.month1Res.value(), this.month2Res.value()].filter(Boolean) as TimesheetMonthDto[];
    const holidays = this.publicHolidays.holidays() ?? {};

    // Build lookup: ticketId → row values
    const rowsByTicket = new Map<number, Record<string, number>>();
    for (const month of months) {
      for (const row of month.rows) {
        const existing = rowsByTicket.get(row.ticketId) ?? {};
        Object.assign(existing, row.values);
        rowsByTicket.set(row.ticketId, existing);
      }
    }

    return days.map((iso) => {
      const values = new Map<number, number>();
      let total = 0;
      for (const col of cols) {
        const v = rowsByTicket.get(col.ticketId)?.[iso] ?? 0;
        values.set(col.ticketId, v);
        total += v;
      }
      const date = new Date(`${iso}T00:00:00`);
      return {
        iso,
        isWeekend: isWeekendIso(iso),
        isHoliday: !!holidays[iso],
        holidayLabel: holidays[iso] ?? '',
        dayLabel: (() => { const s = new Intl.DateTimeFormat(this.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(date); return s.charAt(0).toUpperCase() + s.slice(1); })(),
        total,
        values,
      };
    });
  });

  readonly weekTotal = computed(() => this.dayRows().reduce((s, r) => s + r.total, 0));

  readonly colTotals = computed(() => {
    const cols = this.ticketCols();
    const rows = this.dayRows();
    const map = new Map<number, number>();
    for (const col of cols) {
      map.set(col.ticketId, rows.reduce((s, r) => s + (r.values.get(col.ticketId) ?? 0), 0));
    }
    return map;
  });

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];
    return buildQuickPickOptions(meta, this.unit.unitMode());
  });

  readonly weekLabel = computed(() => {
    const days = this.days();
    if (!days.length) return '';
    const fmt = new Intl.DateTimeFormat(this.dateLocale(), { day: 'numeric', month: 'short' });
    const start = fmt.format(new Date(`${days[0]}T00:00:00`));
    const end = fmt.format(new Date(`${days[6]}T00:00:00`));
    return `S${this.isoWeek()} · ${start} – ${end}`;
  });

  readonly isCurrentWeek = computed(() => this.days().includes(this.todayIso()));

  readonly monthNavParams = computed(() => {
    const [y, m] = this.days()[0].split('-').map(Number);
    return { year: y, month: m };
  });

  readonly monthLabel = computed(() => {
    const [y, m] = this.days()[0].split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const s = new Intl.DateTimeFormat(this.dateLocale(), { month: 'short', year: '2-digit' }).format(date);
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    void this.publicHolidays.load();
    const initial = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((e: LangChangeEvent) => {
      this.language.set(e.lang as AppLanguage);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const week = Number(params.get('week'));
      const year = Number(params.get('year'));
      if (!Number.isInteger(week) || !Number.isInteger(year)) return;
      if (week < 1 || week > 53 || year < 1900 || year > 3000) return;
      untracked(() => {
        this.isoWeek.set(week);
        this.weekYear.set(year);
      });
    });
    effect(() => {
      const week = this.isoWeek();
      const year = this.weekYear();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { year, week },
        replaceUrl: true,
      });
    });

    effect(() => {
      // Restaure l'état du drawer depuis le cache à chaque changement de semaine
      const key = `tt-prev-week-drawer-${this.weekYear()}-${this.isoWeek()}`;
      untracked(() => this.drawerOpen.set(localStorage.getItem(key) === '1'));
    });
  }

  prevWeek(): void { this.shiftWeek(-1); }
  nextWeek(): void { this.shiftWeek(1); }
  goToCurrentWeek(): void {
    const iso = this.todayIso();
    this.isoWeek.set(isoWeekNumber(iso));
    this.weekYear.set(isoWeekYear(iso));
  }

  onDateSelected(date: Date | null, picker: MatDatepicker<Date>): void {
    if (!date) return;
    const iso = toIsoDate(date);
    this.isoWeek.set(isoWeekNumber(iso));
    this.weekYear.set(isoWeekYear(iso));
    picker.close();
  }

  dateLocale(): string {
    return this.language() === 'fr' ? 'fr-FR' : 'en-US';
  }

  buildExtUrl(key: string): string {
    return this.extLinkService.buildUrl(key);
  }

  formatValue(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return '0';
    return this.unit.unitMode() === 'hour'
      ? formatNumberTrimmed(minutes / 60)
      : formatNumberTrimmed(minutes / meta.minutesPerDay);
  }

  formatZeroAware(minutes: number): string {
    return minutes === 0 ? '0' : this.formatValue(minutes);
  }

  onCellClick(row: WeekDayRow, col: WeekTicketCol): void {
    if (row.isWeekend || row.isHoliday) return;
    const data: TimeSlotPickerDialogData = {
      ticketId: col.ticketId,
      ticketRef: `${col.type} ${col.externalKey ?? ''}`.trim(),
      ticketLabel: col.label ?? '',
      dayLabel: row.dayLabel,
      currentMinutes: row.values.get(col.ticketId) ?? 0,
      options: this.quickPickOptions(),
    };
    this.dialog.open(TimeSlotPickerDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((minutes) => {
        if (typeof minutes !== 'number' || Number.isNaN(minutes)) return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: col.ticketId, date: row.iso, quantityMinutes: minutes }),
        ).then(() => this.reloadMonths())
         .catch((error: unknown) => {
           showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
         });
      });
  }

  openAddTicketDialog(): void {
    this.dialog.open(AddTicketDialogComponent, { width: '560px', maxWidth: '95vw' })
      .afterClosed().subscribe((result) => {
        if (!result) return;
        showSnack(this.snackBar, this.translate.instant('ticket_saved'));
        this.metadataRes.reload();
        this.reloadMonths();
        if (result.logTime) this.openTicketEntryDialog(result.ticket);
      });
  }

  openLogTimeDialog(): void {
    const days = this.days();
    const [y, m] = days[0].split('-').map(Number);
    const data: LogTimeDialogData = {
      year: y,
      month: m,
      defaultTickets: this.ticketCols().map((c) => ({
        id: c.ticketId, type: c.type, externalKey: c.externalKey, label: c.label,
      })),
      allTickets: this.allTicketsRes.value() ?? [],
      options: this.quickPickOptions(),
      dateLocale: this.dateLocale(),
      publicHolidays: this.publicHolidays.holidays() ?? {},
    };
    this.dialog.open(LogTimeDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((result: LogTimeDialogResult | undefined) => {
        if (!result) return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: result.ticketId, date: result.date, quantityMinutes: result.minutes }),
        ).then(() => {
          showSnack(this.snackBar, this.translate.instant('time_saved'));
          this.reloadMonths();
        }).catch((error: unknown) => {
          showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
        });
      });
  }

  openPrevWeekTicketDialog(col: WeekTicketCol): void {
    const days = this.days();
    const [y, m] = days[0].split('-').map(Number);
    const ticket: TicketDto = {
      id: col.ticketId,
      type: col.type,
      externalKey: col.externalKey,
      label: col.label,
    };
    const data: LogTimeDialogData = {
      year: y,
      month: m,
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
          this.reloadMonths();
        }).catch((error: unknown) => {
          showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
        });
      });
  }

  private openTicketEntryDialog(ticket: TicketDto): void {
    const data: TimeSlotPickerDialogData = {
      ticketId: ticket.id,
      ticketRef: `${ticket.type} ${ticket.externalKey ?? ''}`.trim(),
      ticketLabel: ticket.label ?? '',
      dayLabel: '',
      currentMinutes: 0,
      options: this.quickPickOptions(),
      initialDate: this.todayIso(),
      dateLocale: this.dateLocale(),
    };
    this.dialog.open(TimeSlotPickerDialogComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed().subscribe((result: TimeSlotPickerDialogResult | undefined) => {
        if (result === undefined || result === null || typeof result === 'number') return;
        void firstValueFrom(
          this.api.upsertTimeEntry({ ticketId: ticket.id, date: result.date, quantityMinutes: result.minutes }),
        ).then(() => this.reloadMonths())
         .catch((error: unknown) => {
           showSnack(this.snackBar, this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
         });
      });
  }

  private reloadMonths(): void {
    this.month1Res.reload();
    this.month2Res.reload();
    this.allTimeTotalsRes.reload();
  }

  private shiftWeek(delta: -1 | 1): void {
    const days = this.days();
    const pivot = new Date(`${delta === 1 ? days[6] : days[0]}T00:00:00`);
    pivot.setDate(pivot.getDate() + delta);
    const iso = toIsoDate(pivot);
    this.isoWeek.set(isoWeekNumber(iso));
    this.weekYear.set(isoWeekYear(iso));
  }

  todayIso(): string {
    return toIsoDate(this.now);
  }
}

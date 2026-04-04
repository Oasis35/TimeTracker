import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { TicketDto, TicketTotalDto, TimesheetMetadataDto, TimesheetMonthDto, TimesheetRowDto } from '../../../core/api/models';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { isWeekendIso } from '../../../core/utils/date-helpers';
import { formatNumberTrimmed } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { resource } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { TimeEntryDialogComponent, TimeEntryDialogData } from '../shared/time-entry-dialog/time-entry-dialog.component';
import { LogTimeDialogComponent, LogTimeDialogData, LogTimeDialogResult } from '../shared/log-time-dialog/log-time-dialog.component';
import { TicketExtLinkComponent } from '../../../shared/ticket-ext-link/ticket-ext-link.component';

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
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    TicketExtLinkComponent,
    TranslateModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'fr-FR' }],
  templateUrl: './timesheet-month-page.html',
  styleUrl: './timesheet-month-page.scss',
})
export class TimesheetMonthPageComponent implements AfterViewInit, OnDestroy {
  private readonly now = new Date();
  private typeHeaderResizeObserver: ResizeObserver | null = null;
  private typeHeaderElement: HTMLElement | null = null;

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
  readonly language = signal<AppLanguage>('fr');
  readonly stickyTypeWidth = signal<number>(90);

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

  readonly publicHolidaysRes = resource<Record<string, string>, number>({
    params: () => 0,
    loader: () =>
      firstValueFrom(
        this.api.getPublicHolidaysMetropole().pipe(catchError(() => of({}))),
      ),
  });

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
  readonly isCurrentMonth = computed(
    () => this.year() === this.now.getFullYear() && this.month() === this.now.getMonth() + 1,
  );
  readonly monthTotal = computed(() => this.rows().reduce((sum, row) => sum + row.total, 0));

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];
    return buildQuickPickOptions(meta, this.unit.unitMode());
  });

  constructor(
    private readonly api: TrackerApi,
    private readonly translate: TranslateService,
    private readonly dateAdapter: DateAdapter<Date>,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    readonly unit: UnitService,
  ) {
    const initial = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
    });
    this.translate.onLangChange.subscribe(() => {
      this.dateAdapter.setLocale(this.dateLocale());
    });
    this.dateAdapter.setLocale(this.dateLocale());
    this.route.queryParamMap.subscribe((params) => {
      const year = Number(params.get('year'));
      const month = Number(params.get('month'));
      if (!Number.isInteger(year) || !Number.isInteger(month)) return;
      if (month < 1 || month > 12) return;
      if (year < 1900 || year > 3000) return;
      this.year.set(year);
      this.month.set(month);
    });
  }

  onMonthSelected(date: Date, picker: MatDatepicker<Date>): void {
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth() + 1);
    picker.close();
  }

  @ViewChild('typeHeaderCell')
  set typeHeaderCell(cell: ElementRef<HTMLElement> | undefined) {
    if (!cell) return;
    this.observeTypeHeader(cell.nativeElement);
  }

  ngAfterViewInit(): void {
    // Width can settle after initial render; align sticky offset once rendered.
    queueMicrotask(() => this.syncTypeWidth());
  }

  ngOnDestroy(): void {
    this.typeHeaderResizeObserver?.disconnect();
  }

  prevMonth(): void {
    this.shiftMonth(-1);
  }

  nextMonth(): void {
    this.shiftMonth(1);
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.year.set(now.getFullYear());
    this.month.set(now.getMonth() + 1);
  }

  dayLabel(dayIso: string): string {
    return dayIso.slice(-2);
  }

  isWeekendIso(dayIso: string): boolean {
    return isWeekendIso(dayIso);
  }

  isHolidayIso(dayIso: string): boolean {
    return !!this.publicHolidaysRes.value()?.[dayIso];
  }

  holidayLabel(dayIso: string): string {
    return this.publicHolidaysRes.value()?.[dayIso] ?? '';
  }

  isSundayIso(dayIso: string): boolean {
    return new Date(`${dayIso}T00:00:00`).getDay() === 0;
  }

  isAlternateWeekBlock(dayIndex: number): boolean {
    return Math.floor(dayIndex / 7) % 2 === 1;
  }

  getTicketAllTimeTooltip(ticketId: number): string {
    const total = this.allTimeTotalsMap().get(ticketId) ?? 0;
    if (total === 0) return '';
    const unit = this.unit.unitMode() === 'hour' ? 'h' : 'j';
    return this.translate.instant('ticket_total_alltime', { value: `${this.formatValue(total)}${unit}` });
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
      this.metadataRes.reload();
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
      publicHolidays: this.publicHolidaysRes.value() ?? {},
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
      });
    });
  }

  onCellClick(row: MonthlyRow, day: string): void {
    if (isWeekendIso(day) || this.isHolidayIso(day)) return;
    const dayLabel = new Intl.DateTimeFormat(this.dateLocale(), { dateStyle: 'long' })
      .format(new Date(`${day}T00:00:00`));
    this.openTicketDayDialog(row.ticketId, `${row.type} ${row.externalKey ?? ''}`.trim(), row.label ?? '', day, dayLabel, this.getCellMinutes(row, day));
  }

  private openTicketEntryDialog(ticket: TicketDto): void {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayLabel = new Intl.DateTimeFormat(this.dateLocale(), { dateStyle: 'long' }).format(today);
    this.openTicketDayDialog(ticket.id, `${ticket.type} ${ticket.externalKey ?? ''}`.trim(), ticket.label ?? '', todayIso, dayLabel, 0);
  }

  private openTicketDayDialog(ticketId: number, ticketRef: string, ticketLabel: string, dateIso: string, dayLabel: string, currentMinutes: number): void {
    const data: TimeEntryDialogData = {
      ticketId,
      ticketRef,
      ticketLabel,
      dayLabel,
      currentMinutes,
      options: this.quickPickOptions(),
    };

    const dialogRef = this.dialog.open(TimeEntryDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });

    dialogRef.afterClosed().subscribe((minutes) => {
      if (typeof minutes !== 'number' || Number.isNaN(minutes)) return;
      void firstValueFrom(
        this.api.upsertTimeEntry({ ticketId, date: dateIso, quantityMinutes: minutes }),
      ).then(() => {
        this.monthRes.reload();
        this.usedTicketsRes.reload();
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

  private observeTypeHeader(el: HTMLElement): void {
    this.typeHeaderElement = el;
    this.typeHeaderResizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') {
      this.syncTypeWidth();
      return;
    }
    this.typeHeaderResizeObserver = new ResizeObserver(() => this.syncTypeWidth());
    this.typeHeaderResizeObserver.observe(el);
    this.syncTypeWidth();
  }

  private syncTypeWidth(): void {
    const width = this.typeHeaderElement
      ? Math.ceil(this.typeHeaderElement.getBoundingClientRect().width)
      : 0;
    if (width > 0 && this.stickyTypeWidth() !== width) {
      this.stickyTypeWidth.set(width);
    }
  }
}

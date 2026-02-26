import { CommonModule } from '@angular/common';
import {
  Component,
  Injectable,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';
import { I18nService } from '../../../core/services/i18n.service';
import { UnitService } from '../../../core/services/unit.service';
import {
  TicketDto,
  TimesheetMetadataDto,
  TimesheetMonthDto,
  TimesheetRowDto,
} from '../../../core/api/models';

type MonthRequest = { y: number; m: number };
type QuickPickOption = { minutes: number; label: string };

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

function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDividerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatNativeDateModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: DateAdapter, useClass: IsoMondayDateAdapter },
  ],
  templateUrl: './timesheet-page.html',
  styleUrl: './timesheet-page.scss',
})
export class TimesheetPageComponent {
  @ViewChild('ticketDialogTpl') ticketDialogTpl?: TemplateRef<unknown>;

  private readonly now = new Date();
  private readonly todayIso = toIsoDate(this.now);
  private ticketDialogRef?: MatDialogRef<unknown>;

  readonly year = signal<number>(this.now.getFullYear());
  readonly month = signal<number>(this.now.getMonth() + 1);
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

  readonly usedTicketsRes = resource<TicketDto[], MonthRequest>({
    params: () => ({ y: this.year(), m: this.month() }),
    loader: ({ params }) => firstValueFrom(this.api.getUsedByMonth(params.y, params.m)),
  });

  readonly loading = computed(
    () => this.metadataRes.isLoading() || this.monthRes.isLoading() || this.usedTicketsRes.isLoading(),
  );
  readonly monthYearLabel = computed(() => {
    const date = new Date(this.year(), this.month() - 1, 1);
    const label = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  
  readonly displayRows = computed<TimesheetRowDto[]>(() => {
    const usedTickets = this.usedTicketsRes.value();
    const month = this.monthRes.value();
    if (!usedTickets || !month) return [];

    const rowsByTicketId = new Map<number, TimesheetRowDto>();
    for (const row of month.rows) {
      rowsByTicketId.set(row.ticketId, row);
    }

    return usedTickets.map((ticket) => {
      const existing = rowsByTicketId.get(ticket.id);
      if (existing) {
        return existing;
      }

      return {
        ticketId: ticket.id,
        type: ticket.type,
        externalKey: ticket.externalKey ?? '',
        label: ticket.label ?? '',
        values: {},
        total: 0,
      };
    });
  });

  readonly error = computed(() => {
    const e = this.metadataRes.error() ?? this.monthRes.error() ?? this.usedTicketsRes.error();
    return e ? this.i18n.tr('cannot_load_data') : null;
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

  readonly quickPickOptions = computed(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [] as QuickPickOption[];

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
  readonly routeSelectedDay: () => string | null;

  constructor(
    private readonly api: TrackerApi,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog,
    private readonly dateAdapter: DateAdapter<Date>,
    readonly i18n: I18nService,
    readonly unit: UnitService,
  ) {
    this.routeSelectedDay = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('day'))), {
      initialValue: null,
    });

    effect(() => {
      this.dateAdapter.setLocale(this.i18n.dateLocale());
    });

    effect(() => {
      const meta = this.metadataRes.value();
      if (!meta) return;

      if (!this.newTicketType().trim()) {
        const defaultType = (meta.defaultType ?? '').toUpperCase();
        this.newTicketType.set(
          this.ticketTypeOptions.includes(defaultType) ? defaultType : this.ticketTypeOptions[0],
        );
      }
    });

    effect(() => {
      const routeDay = this.routeSelectedDay();
      if (!routeDay) return;
      const parsed = parseIsoDate(routeDay);
      if (!parsed) return;
      this.year.set(parsed.getFullYear());
      this.month.set(parsed.getMonth() + 1);
      this.selectedDay.set(routeDay);
    });

    effect(() => {
      const month = this.monthRes.value();
      if (!month || month.days.length === 0) return;

      const selected = this.selectedDay();
      const routeDay = this.routeSelectedDay();
      if (routeDay && selected === routeDay) {
        return;
      }
      if (routeDay && month.days.includes(routeDay)) {
        this.selectedDay.set(routeDay);
        return;
      }
      if (selected && (month.days.includes(selected) || selected === routeDay)) return;

      const firstWeekday = month.days.find((day) => !this.isWeekendIso(day)) ?? month.days[0];
      const defaultDay =
        month.days.includes(this.todayIso) && !this.isWeekendIso(this.todayIso)
          ? this.todayIso
          : firstWeekday;
      this.selectedDay.set(defaultDay);
    });
  }

  onTicketTypeChange(event: MatSelectChange): void {
    this.newTicketType.set((event.value ?? '').toString());
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
    if (!this.ticketDialogTpl) return;
    this.actionError.set('');
    this.ticketDialogRef = this.dialog.open(this.ticketDialogTpl, {
      width: '560px',
      maxWidth: '95vw',
    });
  }

  closeAddTicketDialog(): void {
    this.ticketDialogRef?.close();
  }

  async submitTicketDialog(): Promise<void> {
    const success = await this.addTicket();
    if (success) {
      this.ticketDialogRef?.close();
    }
  }

  async pointMinutes(ticketId: number, quantityMinutes: number): Promise<void> {
    const date = this.selectedDay();

    this.clearActionState();

    if (!date) {
      this.actionError.set(this.i18n.tr('day_required_before_log'));
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
      this.actionMessage.set(this.i18n.tr('time_saved'));
      this.monthRes.reload();
      this.usedTicketsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(this.i18n.tr(resolveApiErrorTranslationKey(error, 'cannot_log_time')));
    } finally {
      this.busy.set(false);
    }
  }

  async addTicket(): Promise<boolean> {
    const type = this.newTicketType().trim();
    const externalKey = this.newTicketExternalKey().trim();
    const label = this.newTicketLabel().trim();

    this.clearActionState();

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
      this.actionMessage.set(this.i18n.tr('ticket_saved'));
      this.metadataRes.reload();
      this.monthRes.reload();
      return true;
    } catch (error: unknown) {
      this.actionError.set(
        this.i18n.tr(resolveApiErrorTranslationKey(error, 'cannot_create_ticket')),
      );
      return false;
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
}

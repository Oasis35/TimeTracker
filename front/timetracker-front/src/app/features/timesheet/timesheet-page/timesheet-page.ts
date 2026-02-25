import { CommonModule } from '@angular/common';
import { Component, Injectable, TemplateRef, ViewChild, computed, effect, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { firstValueFrom } from 'rxjs';
import { TrackerApi } from '../../../core/api/tracker-api';
import { AppLanguage, I18nService, TranslationKey } from '../../../core/i18n/i18n.service';
import { TimesheetMetadataDto, TimesheetMonthDto, TimesheetRowDto, UnitMode } from '../../../core/api/models';

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

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDatepickerModule,
    MatDividerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatNativeDateModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatToolbarModule,
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
  readonly currentLanguage = computed<AppLanguage>(() => this.i18n.language());
  readonly monthYearLabel = computed(() => {
    const date = new Date(this.year(), this.month() - 1, 1);
    const label = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
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
    return e ? this.tr('cannot_load_data') : null;
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
      this.unitMode() === 'hour' ? meta.allowedMinutesHourMode : meta.allowedMinutesDayMode;

    return allowed.map((minutes) => ({
      minutes,
      label: this.formatEntryValue(minutes),
    }));
  });
  readonly selectedDateValue = computed<Date | null>(() => {
    const iso = this.selectedDay();
    return iso ? new Date(`${iso}T00:00:00`) : null;
  });

  constructor(
    private readonly api: TrackerApi,
    private readonly dialog: MatDialog,
    private readonly dateAdapter: DateAdapter<Date>,
    private readonly i18n: I18nService,
  ) {
    effect(() => {
      this.dateAdapter.setLocale(this.i18n.dateLocale());
    });

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

  onLanguageChange(language: AppLanguage): void {
    this.i18n.setLanguage(language);
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
      this.actionError.set(this.tr('day_required_before_log'));
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
      this.actionMessage.set(this.tr('time_saved'));
      this.monthRes.reload();
    } catch {
      this.actionError.set(this.tr('cannot_log_time'));
    } finally {
      this.busy.set(false);
    }
  }

  async addTicket(): Promise<boolean> {
    const type = this.newTicketType().trim();
    const externalKey = this.newTicketExternalKey().trim();
    const label = this.newTicketLabel().trim();

    this.clearActionState();

    if (!type) {
      this.actionError.set(this.tr('type_required'));
      return false;
    }

    if (externalKey && !label) {
      this.actionError.set(this.tr('label_required_with_external'));
      return false;
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
      this.actionMessage.set(this.tr('ticket_saved'));
      this.metadataRes.reload();
      this.monthRes.reload();
      return true;
    } catch {
      this.actionError.set(this.tr('cannot_create_ticket'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private isWeekendIso(isoDate: string): boolean {
    const day = new Date(`${isoDate}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }

  tr(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  formatEntryValue(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return `${minutes} min`;

    if (this.unitMode() === 'hour') {
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

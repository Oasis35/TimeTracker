import { CommonModule } from '@angular/common';
import { Component, computed, effect, resource, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats, MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TicketDetailDto, TicketDto, TicketTimeEntryDto, TimesheetMetadataDto } from '../../../core/api/models';
import { TrackerApi } from '../../../core/api/tracker-api';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { isWeekendIso, parseIsoDate, toIsoDate } from '../../../core/utils/date-helpers';
import { formatMinutes } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import { TicketLookupComponent } from '../shared/ticket-lookup/ticket-lookup.component';

type EntryMonthGroup = { key: string; label: string; totalMinutes: number; entries: TicketTimeEntryDto[] };
type MonthEntryDraft = Record<string, number>;

const TICKET_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'dd/MM',
  },
  display: {
    dateInput: { day: '2-digit', month: '2-digit' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    TicketLookupComponent,
    TranslateModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: TICKET_DATE_FORMATS },
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPageComponent {
  readonly ticketId = signal<number | null>(null);
  readonly language = signal<AppLanguage>('fr');
  readonly completionBusy = signal<boolean>(false);
  readonly busyMonthKey = signal<string | null>(null);
  readonly actionError = signal<string>('');
  readonly expandedMonths = signal<Record<string, boolean>>({});
  readonly editingMonthKey = signal<string | null>(null);
  readonly editingMonthValues = signal<MonthEntryDraft>({});
  readonly editingMonthOriginalValues = signal<MonthEntryDraft>({});

  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });
  readonly publicHolidaysRes = resource<Record<string, string>, number>({
    params: () => 0,
    loader: () =>
      firstValueFrom(
        this.api.getPublicHolidaysMetropole().pipe(catchError(() => of({}))),
      ),
  });
  readonly detailRes = resource<TicketDetailDto | null, number | null>({
    params: () => this.ticketId(),
    loader: ({ params }) => {
      if (params === null || params <= 0) return Promise.resolve(null);
      return firstValueFrom(this.api.getTicketDetail(params));
    },
  });

  readonly loading = computed(() => this.metadataRes.isLoading() || this.detailRes.isLoading());
  readonly ticket = computed(() => this.detailRes.value()?.ticket ?? null);
  readonly entries = computed(() => this.detailRes.value()?.entries ?? []);
  readonly isArchived = computed(() => this.ticket()?.isCompleted ?? false);
  readonly totalMinutes = computed(() => this.detailRes.value()?.totalMinutes ?? 0);
  readonly entryCount = computed(() => this.entries().length);
  readonly entryGroups = computed<EntryMonthGroup[]>(() => {
    this.language();

    const groupsByKey = new Map<string, EntryMonthGroup>();
    const sortedEntries = [...this.entries()].sort((a, b) => b.date.localeCompare(a.date));

    for (const entry of sortedEntries) {
      const monthKey = entry.date.slice(0, 7);
      const existing = groupsByKey.get(monthKey);
      if (existing) {
        existing.entries.push(entry);
        existing.totalMinutes += entry.quantityMinutes;
        continue;
      }

      groupsByKey.set(monthKey, {
        key: monthKey,
        label: this.formatMonthLabel(monthKey),
        totalMinutes: entry.quantityMinutes,
        entries: [entry],
      });
    }

    return Array.from(groupsByKey.values());
  });
  readonly error = computed(() => {
    this.language();
    if (this.metadataRes.error() || this.detailRes.error()) {
      return this.translate.instant('cannot_load_data');
    }
    return null;
  });

  readonly quickPickOptions = computed<QuickPickOption[]>(() => {
    const meta = this.metadataRes.value();
    if (!meta) return [];
    return buildQuickPickOptions(meta, this.unit.unitMode());
  });

  readonly ticketSearchTickets = computed<TicketDto[]>(() =>
    (this.metadataRes.value()?.tickets ?? []).filter(
      (ticket) => ticket.type !== 'ABSENT' && !!ticket.externalKey?.trim(),
    ),
  );

  constructor(
    private readonly api: TrackerApi,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translate: TranslateService,
    private readonly snackBar: MatSnackBar,
    private readonly dateAdapter: DateAdapter<Date>,
    readonly unit: UnitService,
  ) {
    const initial = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.dateAdapter.setLocale(this.dateLocale());
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
      this.dateAdapter.setLocale(this.dateLocale());
    });
    this.route.paramMap.subscribe((params) => {
      const ticketId = Number(params.get('ticketId'));
      if (Number.isInteger(ticketId) && ticketId > 0) {
        this.ticketId.set(ticketId);
        return;
      }
      this.ticketId.set(null);
    });

    effect(() => {
      const groups = this.entryGroups();
      const previous = untracked(() => this.expandedMonths());
      const next: Record<string, boolean> = {};
      for (const group of groups) {
        const existing = previous[group.key];
        next[group.key] = typeof existing === 'boolean' ? existing : this.isDefaultExpandedMonth(group.key);
      }
      this.expandedMonths.set(next);
    });

    effect(() => {
      const editingMonth = this.editingMonthKey();
      if (!editingMonth) return;
      const exists = this.entryGroups().some((group) => group.key === editingMonth);
      if (!exists) {
        this.resetMonthEditingState();
      }
    });

  }

  onTicketLookupSelected(ticket: TicketDto): void {
    if (ticket.id === this.ticketId()) return;
    this.router.navigate(['/ticket', ticket.id]);
  }

  async onCompletionChange(nextValue: boolean): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || ticket.isCompleted === nextValue) return;

    // Leaving edit mode is intentional here: completing a ticket discards local unsaved draft edits.
    this.resetMonthEditingState();
    this.clearActionState();
    this.completionBusy.set(true);
    try {
      await firstValueFrom(this.api.setTicketCompletion(ticket.id, nextValue));
      this.showActionMessage('ticket_updated');
      this.detailRes.reload();
      this.metadataRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_update_ticket')),
      );
    } finally {
      this.completionBusy.set(false);
    }
  }

  isMonthEditing(monthKey: string): boolean {
    return this.editingMonthKey() === monthKey;
  }

  isMonthBusy(monthKey: string): boolean {
    return this.busyMonthKey() === monthKey;
  }

  startMonthEdit(monthKey: string): void {
    if (this.isArchived() || this.busyMonthKey()) return;
    const group = this.entryGroups().find((item) => item.key === monthKey);
    if (!group) return;

    const monthValues = this.toMonthDraft(group.entries);
    this.editingMonthKey.set(monthKey);
    this.editingMonthOriginalValues.set(monthValues);
    this.editingMonthValues.set({ ...monthValues });
    this.expandedMonths.update((expanded) => ({ ...expanded, [monthKey]: true }));
    this.clearActionState();
  }

  cancelMonthEdit(): void {
    this.resetMonthEditingState();
  }

  monthEntriesForDisplay(monthKey: string): TicketTimeEntryDto[] {
    if (!this.isMonthEditing(monthKey)) return [];
    return Object.entries(this.editingMonthValues())
      .map(([date, quantityMinutes]) => ({ date, quantityMinutes }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  onMonthEntryMinutesChange(dateIso: string, minutes: number): void {
    if (!this.editingMonthKey()) return;
    this.editingMonthValues.update((values) => ({
      ...values,
      [dateIso]: minutes,
    }));
  }

  onMonthEntryDateChange(fromDateIso: string, toDateIso: string): void {
    const monthKey = this.editingMonthKey();
    if (!monthKey || !toDateIso || fromDateIso === toDateIso) return;
    if (!toDateIso.startsWith(`${monthKey}-`)) return;
    if (!this.isSelectableWorkdayIso(toDateIso)) {
      this.actionError.set(this.translate.instant('cannot_log_time'));
      return;
    }

    this.editingMonthValues.update((values) => {
      if (!(fromDateIso in values)) return values;
      if (toDateIso in values && toDateIso !== fromDateIso) return values;

      const minutes = values[fromDateIso];
      const next = { ...values };
      delete next[fromDateIso];
      next[toDateIso] = minutes;
      return next;
    });
    this.actionError.set('');
  }

  onMonthEntryDatePicked(fromDateIso: string, pickedDate: Date | null): void {
    if (!pickedDate) return;
    this.onMonthEntryDateChange(fromDateIso, toIsoDate(pickedDate));
  }

  monthMinDateAsDate(monthKey: string): Date | null {
    return parseIsoDate(`${monthKey}-01`);
  }

  monthMaxDateAsDate(monthKey: string): Date | null {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    return parseIsoDate(`${monthKey}-${String(daysInMonth).padStart(2, '0')}`);
  }

  entryDateAsDate(dateIso: string): Date | null {
    return parseIsoDate(dateIso);
  }

  datePickerFilterForMonth(monthKey: string, currentDateIso: string): (date: Date | null) => boolean {
    const usedDates = new Set(
      Object.keys(this.editingMonthValues()).filter((dateIso) => dateIso !== currentDateIso),
    );

    return (date: Date | null): boolean => {
      if (!date) return false;
      const dateIso = toIsoDate(date);
      if (!dateIso.startsWith(`${monthKey}-`)) return false;
      if (usedDates.has(dateIso)) return false;
      return this.isSelectableWorkdayIso(dateIso);
    };
  }

  removeMonthEntry(dateIso: string): void {
    if (!this.editingMonthKey()) return;
    this.editingMonthValues.update((values) => {
      const next = { ...values };
      delete next[dateIso];
      return next;
    });
  }

  addMonthEntry(monthKey: string): void {
    if (!this.isMonthEditing(monthKey)) return;

    const currentValues = this.editingMonthValues();
    const dateIso = this.nextAvailableDateInMonth(monthKey, currentValues);
    if (!dateIso) {
      this.actionError.set(this.translate.instant('cannot_log_time'));
      return;
    }
    const minutes = this.defaultPositiveMinutes();
    if (minutes <= 0) {
      this.actionError.set(this.translate.instant('cannot_log_time'));
      return;
    }

    this.editingMonthValues.update((values) => ({
      ...values,
      [dateIso]: minutes,
    }));
    this.actionError.set('');
  }

  async saveMonth(monthKey: string): Promise<void> {
    const ticketId = this.ticketId();
    const ticket = this.ticket();
    if (!ticketId || !ticket || ticket.isCompleted) return;
    if (!this.isMonthEditing(monthKey) || this.busyMonthKey()) return;

    const originalValues = this.editingMonthOriginalValues();
    const currentValues = this.editingMonthValues();
    const dates = new Set<string>([
      ...Object.keys(originalValues),
      ...Object.keys(currentValues),
    ]);

    const operations = Array.from(dates)
      .sort((a, b) => a.localeCompare(b))
      .flatMap((dateIso) => {
        const original = originalValues[dateIso];
        const current = currentValues[dateIso];
        if (original === undefined && current === undefined) return [];
        if (original === current) return [];
        return [{ dateIso, quantityMinutes: current ?? 0 }];
      });

    if (operations.length === 0) {
      this.showActionMessage('time_saved');
      this.resetMonthEditingState();
      return;
    }

    this.clearActionState();
    this.busyMonthKey.set(monthKey);
    try {
      for (const operation of operations) {
        await firstValueFrom(
          this.api.upsertTimeEntry({
            ticketId,
            date: operation.dateIso,
            quantityMinutes: operation.quantityMinutes,
            comment: null,
          }),
        );
      }

      this.showActionMessage('time_saved');
      this.resetMonthEditingState();
      this.detailRes.reload();
      this.metadataRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')),
      );
    } finally {
      this.busyMonthKey.set(null);
    }
  }

  formatEntryValue(minutes: number): string {
    const meta = this.metadataRes.value();
    if (!meta) return `${minutes} min`;
    return formatMinutes(minutes, meta.minutesPerDay, this.unit.unitMode());
  }

  formatEntryDate(dateIso: string): string {
    const parts = dateIso.split('-');
    if (parts.length !== 3) return dateIso;
    const [, month, day] = parts;
    if (!month || !day) return dateIso;
    return `${day}/${month}`;
  }

  isMonthExpanded(monthKey: string): boolean {
    const value = this.expandedMonths()[monthKey];
    return typeof value === 'boolean' ? value : this.isDefaultExpandedMonth(monthKey);
  }

  toggleMonth(monthKey: string): void {
    this.expandedMonths.update((expanded) => ({
      ...expanded,
      [monthKey]: !this.isMonthExpanded(monthKey),
    }));
  }

  private formatMonthLabel(monthKey: string): string {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return monthKey;
    }

    const monthDate = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat(this.dateLocale(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(monthDate);
  }

  private isDefaultExpandedMonth(monthKey: string): boolean {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    return monthKey === currentMonthKey || monthKey === previousMonthKey;
  }

  private toMonthDraft(entries: TicketTimeEntryDto[]): MonthEntryDraft {
    const values: MonthEntryDraft = {};
    for (const entry of entries) {
      values[entry.date] = entry.quantityMinutes;
    }
    return values;
  }

  private defaultPositiveMinutes(): number {
    const options = this.quickPickOptions();
    const firstPositive = options.find((option) => option.minutes > 0);
    return firstPositive?.minutes ?? options[0]?.minutes ?? 0;
  }

  private nextAvailableDateInMonth(monthKey: string, values: MonthEntryDraft): string | null {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

    const existing = new Set(Object.keys(values));
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (monthKey === currentMonthKey) {
      const today = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`;
      if (!existing.has(today)) return today;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const existingDays = Array.from(existing)
      .map((dateIso) => Number(dateIso.slice(8, 10)))
      .filter((day) => Number.isInteger(day))
      .sort((a, b) => b - a);
    const startDay = existingDays[0] ?? 0;
    for (let day = startDay + 1; day <= daysInMonth; day++) {
      const dateIso = `${monthKey}-${String(day).padStart(2, '0')}`;
      if (!existing.has(dateIso) && this.isSelectableWorkdayIso(dateIso)) return dateIso;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${monthKey}-${String(day).padStart(2, '0')}`;
      if (!existing.has(dateIso) && this.isSelectableWorkdayIso(dateIso)) return dateIso;
    }

    return null;
  }

  private resetMonthEditingState(): void {
    this.editingMonthKey.set(null);
    this.editingMonthValues.set({});
    this.editingMonthOriginalValues.set({});
  }

  private clearActionState(): void {
    this.actionError.set('');
  }

  private showActionMessage(key: string): void {
    showSnack(this.snackBar, this.translate.instant(key));
  }

  private dateLocale(): string {
    return this.language() === 'fr' ? 'fr-FR' : 'en-GB';
  }

  private isSelectableWorkdayIso(isoDate: string): boolean {
    if (isWeekendIso(isoDate)) return false;
    return !this.publicHolidaysRes.value()?.[isoDate];
  }
}

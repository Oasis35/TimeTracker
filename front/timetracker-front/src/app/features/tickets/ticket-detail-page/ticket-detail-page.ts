import { CommonModule } from '@angular/common';
import { TicketExtLinkComponent } from '../../../shared/ticket-ext-link/ticket-ext-link.component';
import { Component, computed, effect, resource, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
import { isWeekendIso, toIsoDate } from '../../../core/utils/date-helpers';
import { formatMinutes } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions, QuickPickOption } from '../../../core/utils/timesheet-helpers';
import { showSnack } from '../../../core/utils/ui-helpers';
import { TimeEntryDialogComponent, TimeEntryDialogData, TimeEntryDialogResult } from '../../../shared/time-entry-dialog.component';
import { TicketLookupComponent } from '../shared/ticket-lookup/ticket-lookup.component';

type EntryMonthGroup = { key: string; label: string; totalMinutes: number; entries: TicketTimeEntryDto[] };
type MonthEntryDraft = Record<string, number>;

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
    TicketExtLinkComponent,
    TicketLookupComponent,
    TranslateModule,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPageComponent {
  readonly ticketId = signal<number | null>(null);
  readonly language = signal<AppLanguage>('fr');
  readonly completionBusy = signal<boolean>(false);
  readonly busy = signal<boolean>(false);
  readonly actionError = signal<string>('');
  readonly expandedMonths = signal<Record<string, boolean>>({});

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

  readonly todayIso = toIsoDate(new Date());
  readonly currentMonthMinutes = computed(() => this.detailRes.value()?.currentMonthMinutes ?? 0);
  readonly previousMonthMinutes = computed(() => this.detailRes.value()?.previousMonthMinutes ?? 0);

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
    private readonly dialog: MatDialog,
    readonly unit: UnitService,
  ) {
    const initial = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
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
  }

  onTicketLookupSelected(ticket: TicketDto): void {
    if (ticket.id === this.ticketId()) return;
    this.router.navigate(['/ticket', ticket.id]);
  }

  async onCompletionChange(nextValue: boolean): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || ticket.isCompleted === nextValue || this.busy()) return;

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

  addEntry(monthKey: string): void {
    const usedDates = (this.entryGroups().find((g) => g.key === monthKey)?.entries ?? []).map((e) => e.date);
    const suggestedDate = this.nextAvailableDateInMonth(monthKey, Object.fromEntries(usedDates.map((d) => [d, 1])));
    void this.openEntryDialog(null, monthKey, suggestedDate ?? undefined);
  }

  async openEntryDialog(existing: TicketTimeEntryDto | null, monthKey: string, defaultDate?: string): Promise<void> {
    const ticketId = this.ticketId();
    const ticket = this.ticket();
    if (!ticketId || !ticket || ticket.isCompleted) return;

    const usedDates = (this.entryGroups().find((g) => g.key === monthKey)?.entries ?? [])
      .map((e) => e.date)
      .filter((d) => d !== existing?.date);

    const result: TimeEntryDialogResult = await firstValueFrom(
      this.dialog
        .open(TimeEntryDialogComponent, {
          data: {
            date: existing?.date ?? defaultDate ?? null,
            quantityMinutes: existing?.quantityMinutes ?? this.defaultPositiveMinutes(),
            monthKey,
            usedDates,
            quickPickOptions: this.quickPickOptions(),
            publicHolidays: this.publicHolidaysRes.value() ?? {},
            locale: this.dateLocale(),
            isNew: existing === null,
          } satisfies TimeEntryDialogData,
          width: '400px',
        })
        .afterClosed(),
    );

    if (!result) return;

    this.clearActionState();
    this.busy.set(true);
    try {
      if (result.action === 'save') {
        if (existing && result.date !== existing.date) {
          await firstValueFrom(this.api.upsertTimeEntry({ ticketId, date: existing.date, quantityMinutes: 0 }));
        }
        await firstValueFrom(
          this.api.upsertTimeEntry({ ticketId, date: result.date, quantityMinutes: result.quantityMinutes }),
        );
      } else if (result.action === 'delete') {
        await firstValueFrom(this.api.upsertTimeEntry({ ticketId, date: existing!.date, quantityMinutes: 0 }));
      }
      this.showActionMessage('time_saved');
      this.detailRes.reload();
      this.metadataRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')),
      );
    } finally {
      this.busy.set(false);
    }
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

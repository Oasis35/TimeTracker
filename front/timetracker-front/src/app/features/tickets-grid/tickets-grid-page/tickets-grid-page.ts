import { CommonModule } from '@angular/common';
import { TicketExtLinkComponent } from '../../../shared/ticket-ext-link/ticket-ext-link.component';
import { Component, DestroyRef, Injectable, OnDestroy, ViewChild, computed, effect, inject, resource, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';
import { CreateTicketDto, TicketDto, TicketTotalDto, TicketType, TimesheetMetadataDto } from '../../../core/api/models';
import { AppLanguage } from '../../../core/i18n/app-language';
import { UnitService } from '../../../core/services/unit.service';
import { formatNumberTrimmed } from '../../../core/utils/number-helpers';
import { buildQuickPickOptions } from '../../../core/utils/timesheet-helpers';
import { toIsoDate } from '../../../core/utils/date-helpers';
import { AddTicketDialogComponent } from '../../tickets/shared/add-ticket-dialog/add-ticket-dialog';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';
import {
  TimeSlotPickerDialogComponent,
  TimeSlotPickerDialogData,
  TimeSlotPickerDialogResult,
} from '../../timesheet/shared/time-slot-picker-dialog/time-slot-picker-dialog.component';

type GridRow = {
  id: number;
  type: TicketType;
  externalKey: string;
  label: string;
  totalMinutes: number;
  isCompleted: boolean;
};
type CompletionFilter = 'open' | 'completed' | 'all';
type EditDraft = { type: string; externalKey: string; label: string };
type EditField = keyof EditDraft;

@Injectable()
class GridPaginatorIntl extends MatPaginatorIntl implements OnDestroy {
  private readonly sub: Subscription;

  constructor(private readonly translate: TranslateService) {
    super();
    this.sub = this.translate.onLangChange.subscribe(() => {
      this.translateLabels();
    });
    this.translateLabels();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 ${this.translate.instant('paginator_of')} ${length}`;
    }

    const start = page * pageSize;
    const end = start < length ? Math.min(start + pageSize, length) : start + pageSize;
    return `${start + 1} - ${end} ${this.translate.instant('paginator_of')} ${length}`;
  };

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private translateLabels(): void {
    this.itemsPerPageLabel = this.translate.instant('paginator_items_per_page');
    this.nextPageLabel = this.translate.instant('paginator_next_page');
    this.previousPageLabel = this.translate.instant('paginator_previous_page');
    this.firstPageLabel = this.translate.instant('paginator_first_page');
    this.lastPageLabel = this.translate.instant('paginator_last_page');
    this.changes.next();
  }
}

@Component({
  selector: 'app-tickets-grid-page',
  standalone: true,
  providers: [{ provide: MatPaginatorIntl, useClass: GridPaginatorIntl }],
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
    TicketExtLinkComponent,
    TranslateModule,
  ],
  templateUrl: './tickets-grid-page.html',
  styleUrl: './tickets-grid-page.scss',
})
export class TicketsGridPageComponent {
  @ViewChild(MatSort)
  set matSort(sort: MatSort | undefined) {
    if (sort) {
      this.tableDataSource.sort = sort;
    }
  }

  @ViewChild(MatPaginator)
  set matPaginator(paginator: MatPaginator | undefined) {
    if (paginator) {
      this.tableDataSource.paginator = paginator;
    }
  }

  readonly displayedColumns: readonly string[] = [
    'type',
    'externalKey',
    'extLink',
    'loggedTime',
    'label',
    'completed',
    'actions',
  ];
  readonly pageSizeOptions: readonly number[] = [10, 25, 50];
  readonly language = signal<AppLanguage>('fr');
  readonly actionError = signal<string>('');
  readonly deletingTicketId = signal<number | null>(null);
  readonly completionTicketId = signal<number | null>(null);
  readonly completionFilter = signal<CompletionFilter>('open');
  readonly editingTicketId = signal<number | null>(null);
  readonly savingTicketId = signal<number | null>(null);
  readonly editDraft = signal<EditDraft>({ type: '', externalKey: '', label: '' });
  readonly textFilter = signal<string>('');

  readonly allTicketsRes = resource<TicketDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getAllTickets()),
  });
  readonly ticketTotalsRes = resource<TicketTotalDto[], number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getTicketTotals()),
  });
  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  readonly rows = computed<GridRow[]>(() => {
    const allTickets = this.allTicketsRes.value();
    const totals = this.ticketTotalsRes.value();
    if (!allTickets) return [];

    const totalsByTicketId = new Map<number, number>();
    for (const row of totals ?? []) {
      totalsByTicketId.set(row.ticketId, row.total);
    }

    return allTickets.map((ticket) => ({
      id: ticket.id,
      type: ticket.type,
      externalKey: ticket.externalKey ?? '',
      label: ticket.label ?? '',
      totalMinutes: totalsByTicketId.get(ticket.id) ?? 0,
      isCompleted: ticket.isCompleted,
    }));
  });
  readonly typeOptions = computed<string[]>(() => {
    const allTickets = this.allTicketsRes.value() ?? [];
    const types = new Set<string>(allTickets.map((t) => t.type).filter((t) => !!t.trim()));
    const currentDraftType = this.editDraft().type.trim();
    if (currentDraftType) {
      types.add(currentDraftType);
    }
    return [...types].sort((a, b) => a.localeCompare(b));
  });

  readonly loading = computed(
    () => this.allTicketsRes.isLoading() || this.ticketTotalsRes.isLoading() || this.metadataRes.isLoading(),
  );
  readonly error = computed(() => {
    this.language();
    return this.allTicketsRes.error() || this.ticketTotalsRes.error() || this.metadataRes.error()
      ? this.translate.instant('cannot_load_data')
      : null;
  });

  readonly tableDataSource = new MatTableDataSource<GridRow>([]);

  constructor(
    private readonly api: TrackerApi,
    private readonly dialog: MatDialog,
    private readonly translate: TranslateService,
    private readonly snackBar: MatSnackBar,
    readonly unit: UnitService,
  ) {
    const destroyRef = inject(DestroyRef);
    const initial =
      (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.language.set(initial);
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: LangChangeEvent) => {
      this.language.set(event.lang as AppLanguage);
    });
    this.tableDataSource.filterPredicate = (row, filter) => {
      let parsed: { q: string; completion: CompletionFilter } = { q: '', completion: 'open' };
      try {
        parsed = JSON.parse(filter) as { q: string; completion: CompletionFilter };
      } catch {
        parsed = { q: this.normalize(filter), completion: 'open' };
      }

      if (parsed.completion === 'open' && row.isCompleted) return false;
      if (parsed.completion === 'completed' && !row.isCompleted) return false;

      if (!parsed.q) return true;
      const haystack = this.normalize(
        `${row.externalKey} ${row.type} ${row.label} ${row.totalMinutes}`,
      );
      return haystack.includes(parsed.q);
    };

    effect(() => {
      this.tableDataSource.data = this.rows();
    });

    this.applyTableFilter();
  }

  onFilterInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.textFilter.set(value);
    this.applyTableFilter();
  }

  onCompletionFilterChange(value: CompletionFilter): void {
    this.completionFilter.set(value);
    this.applyTableFilter();
  }

  openAddTicketDialog(): void {
    const dialogRef = this.dialog.open(AddTicketDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.allTicketsRes.reload();
      this.ticketTotalsRes.reload();
      if (result.logTime) {
        this.openTicketEntryDialog(result.ticket);
      }
    });
  }

  openTicketEntryDialog(ticket: TicketDto): void {
    if (ticket.isCompleted) return;

    const meta = this.metadataRes.value();
    const options = meta ? buildQuickPickOptions(meta, this.unit.unitMode()) : [];
    const dateLocale = this.language() === 'fr' ? 'fr-FR' : 'en-US';

    const data: TimeSlotPickerDialogData = {
      ticketId: ticket.id,
      ticketRef: `${ticket.type} ${ticket.externalKey ?? ''}`.trim(),
      ticketLabel: ticket.label ?? '',
      dayLabel: '',
      currentMinutes: 0,
      options,
      initialDate: toIsoDate(new Date()),
      dateLocale,
    };

    const dialogRef = this.dialog.open(TimeSlotPickerDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
    });

    dialogRef.afterClosed().subscribe((result: TimeSlotPickerDialogResult | undefined) => {
      if (result === undefined || result === null || typeof result === 'number') return;
      void this.pointMinutes(ticket.id, result.minutes, result.date);
    });
  }

  async pointMinutes(ticketId: number, quantityMinutes: number, date: string): Promise<void> {
    try {
      await firstValueFrom(this.api.upsertTimeEntry({ ticketId, date, quantityMinutes }));
      this.showActionMessage('time_saved');
      this.ticketTotalsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_log_time')),
      );
    }
  }

  async deleteTicket(row: GridRow): Promise<void> {
    this.actionError.set('');

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data: { messageKey: 'delete_ticket_confirm' } }).afterClosed(),
    );
    if (!confirmed) return;

    this.deletingTicketId.set(row.id);
    try {
      await firstValueFrom(this.api.deleteTicket(row.id));
      this.showActionMessage('ticket_deleted');
      this.allTicketsRes.reload();
      this.ticketTotalsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_delete_ticket')),
      );
    } finally {
      this.deletingTicketId.set(null);
    }
  }

  async toggleCompletion(row: GridRow): Promise<void> {
    this.actionError.set('');
    this.completionTicketId.set(row.id);

    try {
      await firstValueFrom(this.api.setTicketCompletion(row.id, !row.isCompleted));
      this.showActionMessage('ticket_updated');
      this.allTicketsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_update_ticket')),
      );
    } finally {
      this.completionTicketId.set(null);
    }
  }

  isEditing(ticketId: number): boolean {
    return this.editingTicketId() === ticketId;
  }

  startInlineEdit(row: GridRow): void {
    this.actionError.set('');
    this.editingTicketId.set(row.id);
    this.editDraft.set({
      type: row.type,
      externalKey: row.externalKey,
      label: row.label,
    });
  }

  cancelInlineEdit(): void {
    this.editingTicketId.set(null);
  }

  onInlineEditInput(field: EditField, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.editDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  async saveInlineEdit(row: GridRow): Promise<void> {
    const ticketId = row.id;
    if (this.editingTicketId() !== ticketId) return;

    if (row.totalMinutes > 0) {
      const confirmed = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, { data: { messageKey: 'edit_confirm_has_time' } }).afterClosed(),
      );
      if (!confirmed) return;
    }

    this.actionError.set('');
    this.savingTicketId.set(ticketId);

    const draft = this.editDraft();
    const payload: CreateTicketDto = {
      type: draft.type as TicketType,
      externalKey: draft.externalKey.trim() || null,
      label: draft.label.trim() || null,
    };

    try {
      await firstValueFrom(this.api.updateTicket(ticketId, payload));
      this.showActionMessage('ticket_updated');
      this.editingTicketId.set(null);
      this.allTicketsRes.reload();
      this.ticketTotalsRes.reload();
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_update_ticket')),
      );
    } finally {
      this.savingTicketId.set(null);
    }
  }

  formatLoggedTime(minutes: number): string {
    if (this.unit.unitMode() === 'hour') {
      return formatNumberTrimmed(minutes / 60);
    }

    const minutesPerDay = this.metadataRes.value()?.minutesPerDay ?? 480;
    return formatNumberTrimmed(minutes / minutesPerDay);
  }

  loggedTimeHeader(): string {
    return this.translate.instant('logged_time');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private applyTableFilter(): void {
    const payload = {
      q: this.normalize(this.textFilter()),
      completion: this.completionFilter(),
    };
    this.tableDataSource.filter = JSON.stringify(payload);
    this.tableDataSource.paginator?.firstPage();
  }

  private showActionMessage(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, {
      duration: 2400,
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}

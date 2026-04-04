import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { isWeekendIso, parseIsoDate, toIsoDate } from '../core/utils/date-helpers';
import { QuickPickOption } from '../core/utils/timesheet-helpers';

export interface TimeEntryDialogData {
  date: string | null;
  quantityMinutes: number;
  monthKey: string;
  usedDates: string[];
  quickPickOptions: QuickPickOption[];
  publicHolidays: Record<string, string>;
  locale: string;
  isNew: boolean;
}

export type TimeEntryDialogResult =
  | { action: 'save'; date: string; quantityMinutes: number }
  | { action: 'delete' }
  | null;

const DIALOG_DATE_FORMATS = {
  parse: { dateInput: 'dd/MM/yyyy' },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};

@Component({
  selector: 'app-time-entry-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    TranslateModule,
    MatTooltipModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: DIALOG_DATE_FORMATS },
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      {{ (data.isNew ? 'entry_dialog_add_title' : 'entry_dialog_edit_title') | translate }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <mat-form-field appearance="outline" class="field-full">
        <mat-label>{{ 'entry_dialog_date' | translate }}</mat-label>
        <input
          matInput
          readonly
          [matDatepicker]="picker"
          [(ngModel)]="selectedDate"
          [min]="minDate"
          [max]="maxDate"
          [matDatepickerFilter]="dateFilter"
        />
        <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker startView="month" [startAt]="selectedDate ?? minDate"></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="field-full">
        <mat-label>{{ 'entry_dialog_quantity' | translate }}</mat-label>
        <mat-select [(ngModel)]="selectedMinutes">
          @for (opt of positiveOptions; track opt.minutes) {
            <mat-option [value]="opt.minutes">{{ opt.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (deletePending) {
        <div class="delete-confirm-banner">
          <mat-icon class="delete-confirm-icon">warning_amber</mat-icon>
          <span>{{ 'confirm_delete_entry' | translate }}</span>
        </div>
      }
    </mat-dialog-content>

    <div class="dialog-divider"></div>

    <mat-dialog-actions class="dialog-actions">
      @if (!deletePending) {
        @if (!data.isNew) {
          <button
            mat-icon-button
            type="button"
            class="delete-icon-btn"
            [matTooltip]="'delete_entry' | translate"
            (click)="askDelete()"
          >
            <mat-icon>delete_outline</mat-icon>
          </button>
        }
        <span class="actions-spacer"></span>
        <button mat-button type="button" (click)="onCancel()">{{ 'cancel' | translate }}</button>
        <button mat-flat-button color="primary" type="button" (click)="onSave()" [disabled]="!canSave">
          {{ 'save_ticket' | translate }}
        </button>
      } @else {
        <button mat-button type="button" (click)="cancelDelete()">{{ 'cancel' | translate }}</button>
        <span class="actions-spacer"></span>
        <button mat-flat-button color="warn" type="button" (click)="onDelete()">
          <mat-icon>delete</mat-icon>
          {{ 'confirm' | translate }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      padding: 1.25rem 1.5rem 0.5rem !important;
      margin: 0 !important;
      font-size: 1.15rem !important;
      font-weight: 600 !important;
    }
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.5rem 1.5rem 1rem !important;
      min-width: 320px;
      overflow: visible !important;
    }
    .field-full { width: 100%; }
    .dialog-divider {
      height: 1px;
      background: color-mix(in srgb, var(--mat-sys-outline-variant) 55%, transparent);
      margin: 0 1.5rem;
    }
    .dialog-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.65rem 1rem 0.9rem !important;
      min-height: unset !important;
    }
    .actions-spacer { flex: 1; }
    .delete-icon-btn {
      --mdc-icon-button-state-layer-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.65;
      transition: opacity 120ms ease, color 120ms ease;

      &:hover {
        opacity: 1;
        color: var(--mat-sys-error);
      }
    }
    .delete-confirm-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      background: color-mix(in srgb, var(--mat-sys-error-container, #fde8e8) 60%, transparent);
      color: var(--mat-sys-on-error-container, #7b1111);
      font-size: 0.875rem;
      font-weight: 500;
    }
    .delete-confirm-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
      flex-shrink: 0;
    }
    :host ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
  `],
})
export class TimeEntryDialogComponent {
  selectedDate: Date | null;
  selectedMinutes: number;
  deletePending = false;
  readonly positiveOptions: QuickPickOption[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TimeEntryDialogData,
    private readonly dialogRef: MatDialogRef<TimeEntryDialogComponent, TimeEntryDialogResult>,
    private readonly dateAdapter: DateAdapter<Date>,
  ) {
    this.dateAdapter.setLocale(data.locale);
    this.selectedDate = data.date ? (parseIsoDate(data.date) ?? null) : null;
    this.selectedMinutes = data.quantityMinutes;
    this.positiveOptions = data.quickPickOptions.filter((o) => o.minutes > 0);
  }

  get minDate(): Date | null {
    return parseIsoDate(`${this.data.monthKey}-01`);
  }

  get maxDate(): Date | null {
    const [yearRaw, monthRaw] = this.data.monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const daysInMonth = new Date(year, month, 0).getDate();
    return parseIsoDate(`${this.data.monthKey}-${String(daysInMonth).padStart(2, '0')}`);
  }

  readonly dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const iso = toIsoDate(date);
    if (!iso.startsWith(`${this.data.monthKey}-`)) return false;
    if (this.data.usedDates.includes(iso)) return false;
    if (isWeekendIso(iso)) return false;
    return !this.data.publicHolidays[iso];
  };

  get canSave(): boolean {
    return !!this.selectedDate && this.selectedMinutes > 0;
  }

  onSave(): void {
    if (!this.canSave || !this.selectedDate) return;
    this.dialogRef.close({
      action: 'save',
      date: toIsoDate(this.selectedDate),
      quantityMinutes: this.selectedMinutes,
    });
  }

  askDelete(): void {
    this.deletePending = true;
  }

  cancelDelete(): void {
    this.deletePending = false;
  }

  onDelete(): void {
    this.dialogRef.close({ action: 'delete' });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}

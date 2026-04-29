import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { toIsoDate } from '../../../../core/utils/date-helpers';

type TimeOption = { minutes: number; label: string };

export type TimeSlotPickerDialogData = {
  ticketId: number;
  ticketRef: string;
  ticketLabel: string;
  dayLabel: string;
  currentMinutes: number;
  options: TimeOption[];
  /** When defined, shows an editable date picker pre-filled with this ISO date (YYYY-MM-DD). */
  initialDate?: string;
  /** When defined, shows a read-only date field with this ISO date (YYYY-MM-DD). */
  readonlyDate?: string;
  dateLocale?: string;
};

export type TimeSlotPickerDialogResult = { minutes: number; date: string } | number;

@Component({
  selector: 'app-time-slot-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    TranslateModule,
  ],
  providers: [
    {
      provide: MAT_DATE_LOCALE,
      useFactory: (data: TimeSlotPickerDialogData) => data.dateLocale ?? 'fr-FR',
      deps: [MAT_DIALOG_DATA],
    },
  ],
  templateUrl: './time-slot-picker-dialog.component.html',
  styleUrl: './time-slot-picker-dialog.component.scss',
})
export class TimeSlotPickerDialogComponent {
  readonly data = inject<TimeSlotPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TimeSlotPickerDialogComponent, TimeSlotPickerDialogResult>);
  private readonly dateAdapter = inject(DateAdapter<Date>);

  readonly selectedMinutes = signal<number>(this.data.currentMinutes);
  readonly selectedDate = signal<Date | null>(
    this.data.initialDate ? new Date(`${this.data.initialDate}T00:00:00`) : null,
  );

  get showDatePicker(): boolean {
    return this.data.initialDate !== undefined;
  }

  get showReadonlyDate(): boolean {
    return this.data.readonlyDate !== undefined;
  }

  readonly readonlyDateValue: Date | null = this.data.readonlyDate
    ? new Date(`${this.data.readonlyDate}T00:00:00`)
    : null;

  constructor() {
    if (this.data.dateLocale) {
      this.dateAdapter.setLocale(this.data.dateLocale);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.showDatePicker) {
      const date = this.selectedDate();
      if (!date) return;
      this.dialogRef.close({ minutes: this.selectedMinutes(), date: toIsoDate(date) });
    } else {
      this.dialogRef.close(this.selectedMinutes());
    }
  }
}

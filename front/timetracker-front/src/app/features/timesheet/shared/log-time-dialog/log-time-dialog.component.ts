import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { DateAdapter, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { TicketDto } from '../../../../core/api/models';
import { TicketLookupComponent } from '../../../tickets/shared/ticket-lookup/ticket-lookup.component';
import { QuickPickOption } from '../../../../core/utils/timesheet-helpers';
import { toIsoDate } from '../../../../core/utils/date-helpers';

export type LogTimeDialogData = {
  year: number;
  month: number;
  defaultTickets: TicketDto[];
  allTickets: TicketDto[];
  options: QuickPickOption[];
  dateLocale: string;
  publicHolidays: Record<string, string>;
  preselectedTicket?: TicketDto;
};

export type LogTimeDialogResult = {
  ticketId: number;
  date: string;
  minutes: number;
};

@Component({
  selector: 'app-log-time-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    TicketLookupComponent,
    TranslateModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useFactory: (data: LogTimeDialogData) => data.dateLocale, deps: [MAT_DIALOG_DATA] }],
  templateUrl: './log-time-dialog.component.html',
  styleUrl: './log-time-dialog.component.scss',
})
export class LogTimeDialogComponent {
  readonly data = inject<LogTimeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LogTimeDialogComponent, LogTimeDialogResult>);
  private readonly dateAdapter = inject(DateAdapter<Date>);

  readonly selectedTicket = signal<TicketDto | null>(null);
  readonly selectedDate = signal<Date | null>(null);
  readonly selectedMinutes = signal<number>(0);

  readonly minDate: Date;
  readonly maxDate: Date;
  readonly dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    const iso = toIsoDate(date);
    return !this.data.publicHolidays[iso];
  };

  readonly canSave = computed(
    () => this.selectedTicket() !== null && this.selectedDate() !== null && this.selectedMinutes() > 0,
  );

  constructor() {
    this.dateAdapter.setLocale(this.data.dateLocale);
    this.minDate = new Date(this.data.year, this.data.month - 1, 1);
    this.maxDate = new Date(this.data.year, this.data.month, 0);
    if (this.data.preselectedTicket) {
      this.selectedTicket.set(this.data.preselectedTicket);
    }
  }

  onTicketSelected(ticket: TicketDto): void {
    this.selectedTicket.set(ticket);
  }

  onDateChange(date: Date | null): void {
    this.selectedDate.set(date);
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    const ticket = this.selectedTicket();
    const date = this.selectedDate();
    const minutes = this.selectedMinutes();
    if (!ticket || !date || minutes <= 0) return;

    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    this.dialogRef.close({ ticketId: ticket.id, date: iso, minutes });
  }
}

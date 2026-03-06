import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

type TimeOption = { minutes: number; label: string };

export type TimeEntryDialogData = {
  ticketId: number;
  ticketRef: string;
  ticketLabel: string;
  dayLabel: string;
  currentMinutes: number;
  options: TimeOption[];
};

@Component({
  selector: 'app-time-entry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './time-entry-dialog.component.html',
  styles: [`
    .entry-dialog-content {
      display: grid;
      gap: 0.42rem;
      padding-top: 0.3rem;
    }

    .ticket-ref {
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }

    .ticket-label {
      color: color-mix(in srgb, var(--mat-sys-on-surface-variant) 94%, transparent);
    }

    .entry-day {
      color: color-mix(in srgb, var(--mat-sys-on-surface-variant) 88%, transparent);
      font-size: 0.84rem;
    }

    mat-form-field {
      margin-top: 0.25rem;
    }

    :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `],
})
export class TimeEntryDialogComponent {
  readonly data = inject<TimeEntryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TimeEntryDialogComponent, number>);

  readonly selectedMinutes = signal<number>(this.data.currentMinutes);

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close(this.selectedMinutes());
  }
}

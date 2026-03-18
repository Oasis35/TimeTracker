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
  styleUrl: './time-entry-dialog.component.scss'
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

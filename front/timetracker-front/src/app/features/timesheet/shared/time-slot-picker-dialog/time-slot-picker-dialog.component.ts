import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

type TimeOption = { minutes: number; label: string };

export type TimeSlotPickerDialogData = {
  ticketId: number;
  ticketRef: string;
  ticketLabel: string;
  dayLabel: string;
  currentMinutes: number;
  options: TimeOption[];
};

@Component({
  selector: 'app-time-slot-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './time-slot-picker-dialog.component.html',
  styleUrl: './time-slot-picker-dialog.component.scss'
})
export class TimeSlotPickerDialogComponent {
  readonly data = inject<TimeSlotPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TimeSlotPickerDialogComponent, number>);

  readonly selectedMinutes = signal<number>(this.data.currentMinutes);

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close(this.selectedMinutes());
  }
}

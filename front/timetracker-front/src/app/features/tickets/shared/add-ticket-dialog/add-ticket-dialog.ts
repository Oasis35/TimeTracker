import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../../core/api/api-error-messages';
import { TicketDto, TicketType } from '../../../../core/api/models';
import { TrackerApi } from '../../../../core/api/tracker-api';
import { TimesheetCacheService } from '../../../../core/services/timesheet-cache.service';

@Component({
  selector: 'app-add-ticket-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './add-ticket-dialog.html',
  styleUrl: './add-ticket-dialog.scss',
})
export class AddTicketDialogComponent {
  private readonly api = inject(TrackerApi);
  private readonly cache = inject(TimesheetCacheService);
  private readonly dialogRef = inject(MatDialogRef<AddTicketDialogComponent, { ticket: TicketDto; logTime: boolean } | false>);
  private readonly translate = inject(TranslateService);

  readonly ticketTypeOptions: readonly TicketType[] = ['DEV', 'SUPPORT'];
  readonly busy = signal<boolean>(false);
  readonly actionError = signal<string>('');

  readonly newTicketType = signal<TicketType | ''>('');
  readonly newTicketExternalKey = signal<string>('');
  readonly newTicketLabel = signal<string>('');

  readonly metadataRes = this.cache.metadataRes;

  constructor() {
    effect(() => {
      const meta = this.metadataRes.value();
      if (!meta || this.newTicketType().trim()) return;

      const defaultType = (meta.defaultType ?? '').toUpperCase() as TicketType;
      this.newTicketType.set(
        this.ticketTypeOptions.includes(defaultType) ? defaultType : this.ticketTypeOptions[0],
      );
    });
  }

  onTicketTypeChange(event: MatSelectChange): void {
    this.newTicketType.set((event.value ?? '') as TicketType | '');
  }

  onTicketExternalInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.newTicketExternalKey.set(value);
  }

  onTicketLabelInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.newTicketLabel.set(value);
  }

  close(): void {
    this.dialogRef.close(false);
  }

  async submit(logTime: boolean): Promise<void> {
    const type = this.newTicketType() as TicketType;
    const externalKey = this.newTicketExternalKey().trim();
    const label = this.newTicketLabel().trim();

    this.actionError.set('');
    this.busy.set(true);
    try {
      const createdTicket = await firstValueFrom(
        this.api.createTicket({
          type,
          externalKey: externalKey || null,
          label: label || null,
        }),
      );
      this.dialogRef.close({ ticket: createdTicket, logTime });
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_create_ticket')),
      );
    } finally {
      this.busy.set(false);
    }
  }
}

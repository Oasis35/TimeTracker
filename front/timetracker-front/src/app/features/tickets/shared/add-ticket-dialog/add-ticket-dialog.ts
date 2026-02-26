import { CommonModule } from '@angular/common';
import { Component, effect, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../../core/api/api-error-messages';
import { TimesheetMetadataDto } from '../../../../core/api/models';
import { TrackerApi } from '../../../../core/api/tracker-api';

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
  readonly ticketTypeOptions: readonly string[] = ['DEV', 'SUPPORT', 'CONGES'];
  readonly busy = signal<boolean>(false);
  readonly actionError = signal<string>('');

  readonly newTicketType = signal<string>('');
  readonly newTicketExternalKey = signal<string>('');
  readonly newTicketLabel = signal<string>('');

  readonly metadataRes = resource<TimesheetMetadataDto, number>({
    params: () => 0,
    loader: () => firstValueFrom(this.api.getMetadata()),
  });

  constructor(
    private readonly api: TrackerApi,
    private readonly dialogRef: MatDialogRef<AddTicketDialogComponent, boolean>,
    private readonly translate: TranslateService,
  ) {
    effect(() => {
      const meta = this.metadataRes.value();
      if (!meta || this.newTicketType().trim()) return;

      const defaultType = (meta.defaultType ?? '').toUpperCase();
      this.newTicketType.set(
        this.ticketTypeOptions.includes(defaultType) ? defaultType : this.ticketTypeOptions[0],
      );
    });
  }

  onTicketTypeChange(event: MatSelectChange): void {
    this.newTicketType.set((event.value ?? '').toString());
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

  async submit(): Promise<void> {
    const type = this.newTicketType().trim();
    const externalKey = this.newTicketExternalKey().trim();
    const label = this.newTicketLabel().trim();

    this.actionError.set('');
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.createTicket({
          type,
          externalKey: externalKey || null,
          label: label || null,
        }),
      );
      this.dialogRef.close(true);
    } catch (error: unknown) {
      this.actionError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_create_ticket')),
      );
    } finally {
      this.busy.set(false);
    }
  }
}

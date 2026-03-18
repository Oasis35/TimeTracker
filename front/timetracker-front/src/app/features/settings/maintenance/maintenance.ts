import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';

@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.scss',
})
export class MaintenancePageComponent {
  readonly exportBusy = signal(false);
  readonly restoreBusy = signal(false);
  readonly selectedBackupFileName = signal('');
  readonly maintenanceError = signal('');

  private selectedBackupFile: File | null = null;

  @ViewChild('backupInput') private backupInput?: ElementRef<HTMLInputElement>;

  constructor(
    private readonly api: TrackerApi,
    private readonly translate: TranslateService,
    private readonly snackBar: MatSnackBar,
  ) {}

  // —————————————————————————————————————————
  //    EXPORT DATABASE
  // —————————————————————————————————————————
  async exportBackup(): Promise<void> {
    if (this.exportBusy()) return;

    this.maintenanceError.set('');
    this.exportBusy.set(true);

    try {
      const response = await firstValueFrom(this.api.exportBackup());
      const fileName = this.extractFileName(response) ?? this.defaultBackupFileName();
      const blob = response.body ?? new Blob([], { type: 'application/octet-stream' });
      this.downloadBlob(blob, fileName);

      this.showMessage('backup_export_success');
    } catch (error) {
      this.maintenanceError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_export_backup'))
      );
    } finally {
      this.exportBusy.set(false);
    }
  }

  // —————————————————————————————————————————
  //    IMPORT / RESTORE DATABASE
  // —————————————————————————————————————————
  selectBackupFile(): void {
    this.backupInput?.nativeElement.click();
  }

  onBackupFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    this.selectedBackupFile = file;
    this.selectedBackupFileName.set(file?.name ?? '');
    this.maintenanceError.set('');
  }

  async restoreBackup(): Promise<void> {
    if (this.restoreBusy()) return;

    if (!this.selectedBackupFile) {
      this.maintenanceError.set(this.translate.instant('backup_file_missing'));
      return;
    }

    if (!window.confirm(this.translate.instant('backup_restore_confirm'))) {
      return;
    }

    this.restoreBusy.set(true);
    this.maintenanceError.set('');

    try {
      const result = await firstValueFrom(this.api.restoreBackup(this.selectedBackupFile));
      this.clearSelectedBackup();
      this.showMessage('backup_restore_success', { file: result.safetyBackupFileName });
    } catch (error) {
      this.maintenanceError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_restore_backup'))
      );
    } finally {
      this.restoreBusy.set(false);
    }
  }

  // —————————————————————————————————————————
  //    HELPERS (identiques à SettingsDialog)
  // —————————————————————————————————————————
  private clearSelectedBackup(): void {
    this.selectedBackupFile = null;
    this.selectedBackupFileName.set('');
    if (this.backupInput) {
      this.backupInput.nativeElement.value = '';
    }
  }

  private extractFileName(response: HttpResponse<Blob>): string | null {
    const disposition = response.headers.get('content-disposition');
    if (!disposition) return null;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const basicMatch = disposition.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] ?? null;
  }

  private defaultBackupFileName(): string {
    const now = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `timetracker-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
      now.getHours()
    )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.db`;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private showMessage(key: string, params?: Record<string, string>): void {
    this.snackBar.open(this.translate.instant(key, params), undefined, {
      duration: 2600,
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}

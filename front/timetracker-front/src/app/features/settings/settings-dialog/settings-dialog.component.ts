import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { resolveApiErrorTranslationKey } from '../../../core/api/api-error-messages';
import { TrackerApi } from '../../../core/api/tracker-api';
import { AppLanguage } from '../../../core/i18n/app-language';
import { TimeUnit, UnitService } from '../../../core/services/unit.service';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss',
})
export class SettingsDialogComponent implements OnDestroy {
  readonly currentLanguage = signal<AppLanguage>('fr');
  readonly exportBusy = signal<boolean>(false);
  readonly restoreBusy = signal<boolean>(false);
  readonly selectedBackupFileName = signal<string>('');
  readonly maintenanceError = signal<string>('');

  @ViewChild('backupInput') private backupInput?: ElementRef<HTMLInputElement>;

  private readonly langSubscription: Subscription;
  private selectedBackupFile: File | null = null;

  constructor(
    private readonly dialogRef: MatDialogRef<SettingsDialogComponent>,
    private readonly translate: TranslateService,
    private readonly api: TrackerApi,
    private readonly snackBar: MatSnackBar,
    readonly unit: UnitService,
  ) {
    const initial = (this.translate.currentLang || this.translate.defaultLang || 'fr') as AppLanguage;
    this.currentLanguage.set(initial);
    this.langSubscription = this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.currentLanguage.set(event.lang as AppLanguage);
    });
  }

  ngOnDestroy(): void {
    this.langSubscription.unsubscribe();
  }

  onLanguageChange(language: AppLanguage): void {
    this.translate.use(language);
  }

  onUnitChange(unit: TimeUnit): void {
    this.unit.setUnitMode(unit);
  }

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
    } catch (error: unknown) {
      this.maintenanceError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_export_backup')),
      );
    } finally {
      this.exportBusy.set(false);
    }
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

    this.maintenanceError.set('');
    this.restoreBusy.set(true);
    try {
      const result = await firstValueFrom(this.api.restoreBackup(this.selectedBackupFile));
      this.clearSelectedBackup();
      this.showMessage('backup_restore_success', { file: result.safetyBackupFileName });
    } catch (error: unknown) {
      this.maintenanceError.set(
        this.translate.instant(resolveApiErrorTranslationKey(error, 'cannot_restore_backup')),
      );
    } finally {
      this.restoreBusy.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private clearSelectedBackup(): void {
    this.selectedBackupFile = null;
    this.selectedBackupFileName.set('');
    if (this.backupInput) {
      this.backupInput.nativeElement.value = '';
    }
  }

  private showMessage(key: string, params?: Record<string, string>): void {
    this.snackBar.open(this.translate.instant(key, params), undefined, {
      duration: 2600,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
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
    const pad = (value: number) => String(value).padStart(2, '0');
    return `timetracker-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.db`;
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
}

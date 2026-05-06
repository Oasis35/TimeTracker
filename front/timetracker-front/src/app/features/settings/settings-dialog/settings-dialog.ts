import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AppLanguage } from '../../../core/i18n/app-language';
import { TimeUnit, UnitService } from '../../../core/services/unit.service';
import { ExternalLinkService } from '../../../core/services/external-link.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TrackerApi } from '../../../core/api/tracker-api';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';
import { MaintenancePageComponent } from '../maintenance/maintenance';

const DEFAULT_HOURS_PER_DAY = 7;

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
    MaintenancePageComponent,
  ],
  templateUrl: './settings-dialog.html',
  styleUrls: ['./settings-dialog.scss'],
})
export class SettingsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SettingsDialogComponent>);
  private readonly translate = inject(TranslateService);
  private readonly matDialog = inject(MatDialog);
  private readonly api = inject(TrackerApi);
  readonly unit = inject(UnitService);
  readonly extLink = inject(ExternalLinkService);
  readonly appSettings = inject(AppSettingsService);

  readonly currentLanguage = signal<AppLanguage>('fr');
  readonly externalBaseUrl = signal<string>('');
  readonly externalUrlPreview = computed(() => {
    const base = this.externalBaseUrl();
    return base ? `${base}ABC-123` : '';
  });

  readonly hoursPerDay = signal<number>(DEFAULT_HOURS_PER_DAY);
  readonly hoursPerDayError = signal<string>('');

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.externalBaseUrl.set(this.extLink.baseUrl());
    const initialLang = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.currentLanguage.set(initialLang);

    const storedMinutes = this.appSettings.minutesPerDay();
    this.hoursPerDay.set(storedMinutes != null ? storedMinutes / 60 : DEFAULT_HOURS_PER_DAY);

    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: LangChangeEvent) => {
      this.currentLanguage.set(event.lang as AppLanguage);
    });
  }

  onLanguageChange(language: AppLanguage): void {
    this.translate.use(language);
  }

  onUnitChange(unit: TimeUnit): void {
    this.unit.setUnitMode(unit);
  }

  onExternalBaseUrlChange(value: string): void {
    this.externalBaseUrl.set(value);
    this.extLink.setBaseUrl(value.trim());
  }

  onHoursPerDayInput(raw: string): void {
    const parsed = parseInt(raw, 10);
    if (!raw || !Number.isFinite(parsed) || parsed < 1 || parsed > 24 || parsed % 4 !== 0) {
      this.hoursPerDayError.set('settings_hours_per_day_invalid');
    } else {
      this.hoursPerDayError.set('');
    }
  }

  async onHoursPerDayCommit(raw: string): Promise<void> {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 24 || parsed % 4 !== 0) {
      const current = this.appSettings.minutesPerDay();
      this.hoursPerDay.set(current != null ? current / 60 : DEFAULT_HOURS_PER_DAY);
      this.hoursPerDayError.set('');
      return;
    }

    const newMinutes = parsed * 60;
    const currentMinutes = this.appSettings.minutesPerDay() ?? DEFAULT_HOURS_PER_DAY * 60;
    if (newMinutes === currentMinutes) return;

    const { count } = await firstValueFrom(this.api.getDaysExceeding(newMinutes));
    if (count > 0) {
      const confirmed = await firstValueFrom(
        this.matDialog.open(ConfirmDialogComponent, {
          data: { messageKey: 'settings_hours_per_day_conflict', messageParams: { count } },
        }).afterClosed(),
      );
      if (!confirmed) {
        this.hoursPerDay.set(currentMinutes / 60);
        return;
      }
    }

    this.hoursPerDay.set(parsed);
    this.hoursPerDayError.set('');
    await firstValueFrom(this.appSettings.set('minutesPerDay', String(newMinutes)));
  }

  close(): void {
    this.dialogRef.close();
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppLanguage } from '../../../core/i18n/app-language';
import { TimeUnit, UnitService } from '../../../core/services/unit.service';
import { ExternalLinkService } from '../../../core/services/external-link.service';
import { MaintenancePageComponent } from '../maintenance/maintenance';

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
  readonly unit = inject(UnitService);
  readonly extLink = inject(ExternalLinkService);

  readonly currentLanguage = signal<AppLanguage>('fr');
  readonly externalBaseUrl = signal<string>('');
  readonly externalUrlPreview = computed(() => {
    const base = this.externalBaseUrl();
    return base ? `${base}ABC-123` : '';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.externalBaseUrl.set(this.extLink.baseUrl());
    const initialLang = (this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr') as AppLanguage;
    this.currentLanguage.set(initialLang);

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

  close(): void {
    this.dialogRef.close();
  }
}

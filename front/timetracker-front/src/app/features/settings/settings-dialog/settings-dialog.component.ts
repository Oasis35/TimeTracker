import { CommonModule } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
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
    TranslateModule,
  ],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss',
})
export class SettingsDialogComponent implements OnDestroy {
  readonly currentLanguage = signal<AppLanguage>('fr');
  private readonly langSubscription: Subscription;

  constructor(
    private readonly dialogRef: MatDialogRef<SettingsDialogComponent>,
    private readonly translate: TranslateService,
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

  close(): void {
    this.dialogRef.close();
  }
}

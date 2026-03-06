import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppLanguage } from './core/i18n/app-language';
import { UnitService, TimeUnit } from './core/services/unit.service';
import { SettingsDialogComponent } from './features/settings/settings-dialog/settings-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(
    private readonly translate: TranslateService,
    private readonly dialog: MatDialog,
    readonly unit: UnitService,
  ) {
    this.translate.setDefaultLang('fr');
    const initial =
      (this.translate.currentLang || this.translate.defaultLang || 'fr') as AppLanguage;
    void this.translate.use(initial);
    this.currentLanguage.set(initial);
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      this.currentLanguage.set(event.lang as AppLanguage);
    });
  }

  onLanguageChange(language: AppLanguage): void {
    this.translate.use(language);
  }

  onTimeChange(unit: TimeUnit): void {
    this.unit.setUnitMode(unit);
  }

  openSettingsDialog(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  readonly currentLanguage = signal<AppLanguage>('fr');
}

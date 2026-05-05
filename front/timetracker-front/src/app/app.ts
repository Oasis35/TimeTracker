import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppLanguage } from './core/i18n/app-language';
import { UnitService } from './core/services/unit.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { IncompleteDaysService } from './core/services/incomplete-days.service';
import { SettingsDialogComponent } from './features/settings/settings-dialog/settings-dialog';

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
  private readonly appSettings = inject(AppSettingsService);
  readonly incompleteDays = inject(IncompleteDaysService);
  readonly currentLanguage = signal<AppLanguage>('fr');

  readonly incompleteDaysTooltip = computed(() => {
    const count = this.incompleteDays.count();
    const days = this.incompleteDays.days();
    if (count === 0) return this.translate.instant('incomplete_days_tooltip_ok');
    const locale = this.currentLanguage() === 'fr' ? 'fr-FR' : 'en-US';
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const formatted = days.map(d => fmt.format(new Date(`${d}T00:00:00`))).join('\n');
    return this.translate.instant('incomplete_days_tooltip_warning', { count, days: formatted });
  });

  constructor(
    private readonly translate: TranslateService,
    private readonly dialog: MatDialog,
    readonly unit: UnitService,
  ) {
    this.translate.setDefaultLang('fr');
    const initial = this.appSettings.language();
    void this.translate.use(initial);
    this.currentLanguage.set(initial);

    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      const language = this.parseAppLanguage(event.lang) ?? 'fr';
      this.currentLanguage.set(language);
      this.appSettings.set('language', language).subscribe();
    });
  }

  openSettingsDialog(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  private parseAppLanguage(value: string | null | undefined): AppLanguage | null {
    if (value === 'fr' || value === 'en') return value;
    return null;
  }
}

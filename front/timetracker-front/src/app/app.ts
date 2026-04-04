import { Component, inject, signal } from '@angular/core';
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

  readonly currentLanguage = signal<AppLanguage>('fr');
}

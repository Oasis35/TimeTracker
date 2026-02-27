import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppLanguage } from './core/i18n/app-language';
import { UnitService, TimeUnit } from './core/services/unit.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonToggleModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(
    private readonly translate: TranslateService,
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

  readonly currentLanguage = signal<AppLanguage>('fr');
}

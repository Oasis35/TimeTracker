import { Component, computed } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppLanguage, I18nService } from './core/services/i18n.service';
import { UnitService, TimeUnit } from './core/services/unit.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonToggleModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(
    readonly i18n: I18nService,
    readonly unit: UnitService,
  ) {}

  onLanguageChange(language: AppLanguage): void {
    this.i18n.setLanguage(language);
  }

  onTimeChange(unit: TimeUnit): void {
    this.unit.setUnitMode(unit);
  }

  readonly currentLanguage = computed<AppLanguage>(() => this.i18n.language());
}

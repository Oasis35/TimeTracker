import { inject, Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';

export type TimeUnit = 'day' | 'hour';

@Injectable({ providedIn: 'root' })
export class UnitService {
  private readonly appSettings = inject(AppSettingsService);

  readonly unitMode = this.appSettings.unitMode;

  setUnitMode(unit: TimeUnit): void {
    this.appSettings.set('unitMode', unit).subscribe();
  }
}

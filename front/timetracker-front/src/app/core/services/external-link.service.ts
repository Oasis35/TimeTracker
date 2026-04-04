import { inject, Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';

@Injectable({ providedIn: 'root' })
export class ExternalLinkService {
  private readonly appSettings = inject(AppSettingsService);

  readonly baseUrl = this.appSettings.externalBaseUrl;

  setBaseUrl(url: string): void {
    if (url) {
      this.appSettings.set('externalBaseUrl', url).subscribe();
    } else {
      this.appSettings.remove('externalBaseUrl').subscribe();
    }
  }

  buildUrl(externalKey: string): string {
    const base = this.baseUrl();
    if (!base || !externalKey) return '';
    return base + externalKey;
  }
}

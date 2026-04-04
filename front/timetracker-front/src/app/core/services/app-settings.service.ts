import { computed, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TrackerApi } from '../api/tracker-api';
import type { AppLanguage } from '../i18n/app-language';
import type { TimeUnit } from './unit.service';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly _raw = signal<Record<string, string>>({});

  readonly language = computed<AppLanguage>(() => {
    const v = this._raw()['language'];
    return v === 'en' ? 'en' : 'fr';
  });

  readonly unitMode = computed<TimeUnit>(() => {
    const v = this._raw()['unitMode'];
    return v === 'hour' ? 'hour' : 'day';
  });

  readonly externalBaseUrl = computed<string>(() => {
    return this._raw()['externalBaseUrl'] ?? '';
  });

  constructor(private readonly api: TrackerApi) {}

  load(): Promise<void> {
    return firstValueFrom(this.api.getSettings())
      .then(settings => this._raw.set(settings))
      .catch(() => {});
  }

  set(key: string, value: string) {
    return this.api.setSetting(key, value).pipe(
      tap(() => this._raw.update(s => ({ ...s, [key]: value }))),
    );
  }

  remove(key: string) {
    return this.api.deleteSetting(key).pipe(
      tap(() =>
        this._raw.update(s => {
          const copy = { ...s };
          delete copy[key];
          return copy;
        }),
      ),
    );
  }
}

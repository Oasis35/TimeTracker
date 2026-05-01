import { computed, inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TrackerApi } from '../api/tracker-api';
import type { AppLanguage } from '../i18n/app-language';
import type { TimeUnit } from './unit.service';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly _raw = signal<Record<string, string>>({});
  private readonly snackBar = inject(MatSnackBar);

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
      .catch(() => {
        this.snackBar.open(
          'Impossible de charger les paramètres. Les valeurs par défaut sont utilisées.',
          undefined,
          { duration: 5000, horizontalPosition: 'right', verticalPosition: 'top' },
        );
      });
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

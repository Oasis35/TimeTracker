import { Injectable, signal, computed } from '@angular/core';
import { catchError, firstValueFrom } from 'rxjs';
import { of } from 'rxjs';
import { TrackerApi } from '../api/tracker-api';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PublicHolidaysService {
  private readonly _holidays = signal<Record<string, string>>({});
  private _loadedAt: number | null = null;

  readonly holidays = computed(() => this._holidays());

  constructor(private readonly api: TrackerApi) {}

  load(): Promise<void> {
    const now = Date.now();
    if (this._loadedAt !== null && now - this._loadedAt < TTL_MS) return Promise.resolve();
    return firstValueFrom(
      this.api.getPublicHolidaysMetropole().pipe(catchError(() => of(null))),
    ).then(h => {
      if (h !== null) {
        this._holidays.set(h);
        this._loadedAt = Date.now();
      }
    });
  }
}

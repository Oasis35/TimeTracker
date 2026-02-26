import { Injectable, signal } from '@angular/core';

export type TimeUnit = 'day' | 'hour';

@Injectable({ providedIn: 'root' })
export class UnitService {
  readonly unitMode = signal<TimeUnit>('day');

  setUnitMode(unit: TimeUnit): void {
    this.unitMode.set(unit);
  }
}

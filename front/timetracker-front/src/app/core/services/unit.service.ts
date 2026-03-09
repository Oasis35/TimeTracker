import { Injectable, signal } from '@angular/core';
export type TimeUnit = 'day' | 'hour';
const UNIT_MODE_STORAGE_KEY = 'tt.unitMode';

@Injectable({ providedIn: 'root' })
export class UnitService {
  readonly unitMode = signal<TimeUnit>('day');

  constructor() {
    const stored = this.readStoredUnitMode();
    if (stored) {
      this.unitMode.set(stored);
    }
  }

  setUnitMode(unit: TimeUnit): void {
    this.unitMode.set(unit);
    this.persistUnitMode(unit);
  }

  private readStoredUnitMode(): TimeUnit | null {
    try {
      const raw = localStorage.getItem(UNIT_MODE_STORAGE_KEY);
      return raw === 'day' || raw === 'hour' ? raw : null;
    } catch {
      return null;
    }
  }

  private persistUnitMode(unit: TimeUnit): void {
    try {
      localStorage.setItem(UNIT_MODE_STORAGE_KEY, unit);
    } catch {
      // Ignore storage errors (private mode, blocked storage).
    }
  }
}

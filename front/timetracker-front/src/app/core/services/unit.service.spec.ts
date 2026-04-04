import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UnitService } from './unit.service';
import { AppSettingsService } from './app-settings.service';

describe('UnitService', () => {
  let rawSignal: ReturnType<typeof signal<Record<string, string>>>;

  function makeAppSettingsMock(initial: Record<string, string> = {}) {
    rawSignal = signal(initial);
    const mock = {
      unitMode: () => {
        const v = rawSignal()['unitMode'];
        return v === 'hour' ? 'hour' : 'day';
      },
      set: vi.fn((key: string, value: string) => {
        return of(undefined).pipe();
      }),
    };
    // make set() actually update the signal so computed signals react
    mock.set = vi.fn((key: string, value: string) => {
      rawSignal.update(s => ({ ...s, [key]: value }));
      return of(void 0);
    });
    return mock;
  }

  it('uses day as default mode', () => {
    const appSettingsMock = makeAppSettingsMock();
    TestBed.configureTestingModule({
      providers: [{ provide: AppSettingsService, useValue: appSettingsMock }],
    });
    const service = TestBed.inject(UnitService);
    expect(service.unitMode()).toBe('day');
  });

  it('updates mode when setUnitMode is called', () => {
    const appSettingsMock = makeAppSettingsMock();
    TestBed.configureTestingModule({
      providers: [{ provide: AppSettingsService, useValue: appSettingsMock }],
    });
    const service = TestBed.inject(UnitService);
    service.setUnitMode('hour');
    expect(appSettingsMock.set).toHaveBeenCalledWith('unitMode', 'hour');
  });

  it('reflects hour mode when AppSettingsService returns hour', () => {
    const appSettingsMock = makeAppSettingsMock({ unitMode: 'hour' });
    TestBed.configureTestingModule({
      providers: [{ provide: AppSettingsService, useValue: appSettingsMock }],
    });
    const service = TestBed.inject(UnitService);
    expect(service.unitMode()).toBe('hour');
  });

  it('delegates setUnitMode to AppSettingsService.set', () => {
    const appSettingsMock = makeAppSettingsMock();
    TestBed.configureTestingModule({
      providers: [{ provide: AppSettingsService, useValue: appSettingsMock }],
    });
    const service = TestBed.inject(UnitService);
    service.setUnitMode('hour');
    expect(appSettingsMock.set).toHaveBeenCalledWith('unitMode', 'hour');
    expect(appSettingsMock.set).toHaveBeenCalledTimes(1);
  });
});

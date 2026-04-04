import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AppSettingsService } from './app-settings.service';
import { TrackerApi } from '../api/tracker-api';

function makeApiMock(settings: Record<string, string> = {}) {
  return {
    getSettings: vi.fn(() => of(settings)),
    setSetting: vi.fn(() => of(void 0)),
    deleteSetting: vi.fn(() => of(void 0)),
  };
}

describe('AppSettingsService', () => {
  it('defaults language to fr when no settings loaded', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: makeApiMock() }],
    });
    const service = TestBed.inject(AppSettingsService);
    expect(service.language()).toBe('fr');
  });

  it('defaults unitMode to day when no settings loaded', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: makeApiMock() }],
    });
    const service = TestBed.inject(AppSettingsService);
    expect(service.unitMode()).toBe('day');
  });

  it('defaults externalBaseUrl to empty string when no settings loaded', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: makeApiMock() }],
    });
    const service = TestBed.inject(AppSettingsService);
    expect(service.externalBaseUrl()).toBe('');
  });

  it('load() populates typed signals from API response', async () => {
    const apiMock = makeApiMock({ language: 'en', unitMode: 'hour', externalBaseUrl: 'https://jira.example.com/' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);

    await service.load();

    expect(service.language()).toBe('en');
    expect(service.unitMode()).toBe('hour');
    expect(service.externalBaseUrl()).toBe('https://jira.example.com/');
  });

  it('load() does not throw when API fails', async () => {
    const apiMock = {
      getSettings: vi.fn(() => throwError(() => new Error('network error'))),
      setSetting: vi.fn(() => of(void 0)),
      deleteSetting: vi.fn(() => of(void 0)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);

    await expect(service.load()).resolves.toBeUndefined();
    expect(service.language()).toBe('fr'); // fallback
  });

  it('set() calls API and updates local signal', async () => {
    const apiMock = makeApiMock();
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);

    await new Promise<void>(resolve => service.set('unitMode', 'hour').subscribe(() => resolve()));

    expect(apiMock.setSetting).toHaveBeenCalledWith('unitMode', 'hour');
    expect(service.unitMode()).toBe('hour');
  });

  it('remove() calls API and removes key from local signal', async () => {
    const apiMock = makeApiMock({ externalBaseUrl: 'https://jira.example.com/' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);
    await service.load();
    expect(service.externalBaseUrl()).toBe('https://jira.example.com/');

    await new Promise<void>(resolve => service.remove('externalBaseUrl').subscribe(() => resolve()));

    expect(apiMock.deleteSetting).toHaveBeenCalledWith('externalBaseUrl');
    expect(service.externalBaseUrl()).toBe('');
  });

  it('unknown language value falls back to fr', async () => {
    const apiMock = makeApiMock({ language: 'de' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);
    await service.load();
    expect(service.language()).toBe('fr');
  });

  it('unknown unitMode value falls back to day', async () => {
    const apiMock = makeApiMock({ unitMode: 'week' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(AppSettingsService);
    await service.load();
    expect(service.unitMode()).toBe('day');
  });
});

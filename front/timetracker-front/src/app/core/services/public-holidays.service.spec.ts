import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PublicHolidaysService } from './public-holidays.service';
import { TrackerApi } from '../api/tracker-api';

function makeApiMock(holidays: Record<string, string> = {}) {
  return {
    getPublicHolidaysMetropole: vi.fn(() => of(holidays)),
  };
}

describe('PublicHolidaysService', () => {
  it('returns empty holidays before load', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: makeApiMock() }],
    });
    const service = TestBed.inject(PublicHolidaysService);
    expect(service.holidays()).toEqual({});
  });

  it('load() populates holidays from API', async () => {
    const data = { '2026-01-01': 'Jour de l\'An', '2026-05-01': 'Fête du Travail' };
    const apiMock = makeApiMock(data);
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(PublicHolidaysService);

    await service.load();

    expect(service.holidays()).toEqual(data);
  });

  it('load() does not throw and keeps empty holidays when API fails', async () => {
    const apiMock = {
      getPublicHolidaysMetropole: vi.fn(() => throwError(() => new Error('network error'))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(PublicHolidaysService);

    await expect(service.load()).resolves.toBeUndefined();
    expect(service.holidays()).toEqual({});
  });

  it('load() does not call API again within TTL', async () => {
    const apiMock = makeApiMock({ '2026-01-01': 'Jour de l\'An' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(PublicHolidaysService);

    await service.load();
    await service.load();

    expect(apiMock.getPublicHolidaysMetropole).toHaveBeenCalledTimes(1);
  });

  it('load() calls API again after TTL expires', async () => {
    const apiMock = makeApiMock({ '2026-01-01': 'Jour de l\'An' });
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(PublicHolidaysService);

    await service.load();

    // Simulate TTL expiry by manipulating internal state
    (service as any)._loadedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;

    await service.load();

    expect(apiMock.getPublicHolidaysMetropole).toHaveBeenCalledTimes(2);
  });
});

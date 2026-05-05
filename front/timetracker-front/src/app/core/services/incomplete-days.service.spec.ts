import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { IncompleteDaysService } from './incomplete-days.service';
import { TrackerApi } from '../api/tracker-api';

@Component({ standalone: true, template: '' })
class HostComponent {}

async function setup(incompleteDays: string[] = []) {
  const apiMock = {
    getIncompleteDays: vi.fn(() => of({ incompleteDays })),
  };
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: TrackerApi, useValue: apiMock }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  const service = TestBed.inject(IncompleteDaysService);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { service, apiMock, fixture };
}

describe('IncompleteDaysService', () => {
  it('days() returns empty array before resource loads', () => {
    const apiMock = { getIncompleteDays: vi.fn(() => of({ incompleteDays: ['2026-04-01'] })) };
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(IncompleteDaysService);
    expect(service.days()).toEqual([]);
  });

  it('count() returns 0 before resource loads', () => {
    const apiMock = { getIncompleteDays: vi.fn(() => of({ incompleteDays: ['2026-04-01'] })) };
    TestBed.configureTestingModule({
      providers: [{ provide: TrackerApi, useValue: apiMock }],
    });
    const service = TestBed.inject(IncompleteDaysService);
    expect(service.count()).toBe(0);
  });

  it('days() returns incomplete days from API after resource resolves', async () => {
    const { service } = await setup(['2026-04-01', '2026-04-02']);
    expect(service.days()).toEqual(['2026-04-01', '2026-04-02']);
  });

  it('count() returns the number of incomplete days', async () => {
    const { service } = await setup(['2026-04-01', '2026-04-02', '2026-04-03']);
    expect(service.count()).toBe(3);
  });

  it('days() returns empty array when API returns none', async () => {
    const { service } = await setup([]);
    expect(service.days()).toEqual([]);
  });

  it('reload() triggers a new API call', async () => {
    const { service, apiMock, fixture } = await setup([]);
    expect(apiMock.getIncompleteDays).toHaveBeenCalledTimes(1);
    service.reload();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(apiMock.getIncompleteDays).toHaveBeenCalledTimes(2);
  });
});

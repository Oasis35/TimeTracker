import { TestBed } from '@angular/core/testing';
import { UnitService } from './unit.service';

describe('UnitService', () => {
  beforeEach(() => {
    localStorage.removeItem('tt.unitMode');
    TestBed.configureTestingModule({});
  });

  it('uses day as default mode', () => {
    const service = TestBed.inject(UnitService);
    expect(service.unitMode()).toBe('day');
  });

  it('updates mode when setUnitMode is called', () => {
    const service = TestBed.inject(UnitService);
    service.setUnitMode('hour');
    expect(service.unitMode()).toBe('hour');
  });

  it('loads persisted mode from local storage', () => {
    localStorage.setItem('tt.unitMode', 'hour');
    const service = TestBed.inject(UnitService);
    expect(service.unitMode()).toBe('hour');
  });

  it('persists mode in local storage when changed', () => {
    const service = TestBed.inject(UnitService);
    service.setUnitMode('hour');
    expect(localStorage.getItem('tt.unitMode')).toBe('hour');
  });
});

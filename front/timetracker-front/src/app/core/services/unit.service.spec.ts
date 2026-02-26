import { TestBed } from '@angular/core/testing';
import { UnitService } from './unit.service';

describe('UnitService', () => {
  beforeEach(() => {
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
});

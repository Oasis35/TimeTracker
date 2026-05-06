import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { SettingsDialogComponent } from './settings-dialog';

describe('SettingsDialogComponent', () => {
  const dialogRefMock = { close: vi.fn() };

  const appSettingsMock = {
    minutesPerDay: signal<number | null>(420),
    set: vi.fn().mockReturnValue(of(undefined)),
    language: signal('fr'),
    unitMode: signal('day'),
    externalBaseUrl: signal(''),
  };

  const apiMock = {
    exportBackup: vi.fn(),
    restoreBackup: vi.fn(),
    getDaysExceeding: vi.fn().mockReturnValue(of({ count: 0 })),
  };

  const matDialogMock = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getDaysExceeding.mockReturnValue(of({ count: 0 }));
    appSettingsMock.set.mockReturnValue(of(undefined));
    matDialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    appSettingsMock.minutesPerDay.set(420);

    await TestBed.configureTestingModule({
      imports: [SettingsDialogComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: TrackerApi, useValue: apiMock },
        { provide: AppSettingsService, useValue: appSettingsMock },
      ],
    })
      .overrideProvider(MatDialog, { useValue: matDialogMock })
      .compileComponents();
  });

  it('initializes hoursPerDay from appSettings', () => {
    appSettingsMock.minutesPerDay.set(480);
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.hoursPerDay()).toBe(8);
  });

  it('uses default 7h when minutesPerDay is null', () => {
    appSettingsMock.minutesPerDay.set(null);
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.hoursPerDay()).toBe(7);
  });

  it('onHoursPerDayInput sets error for invalid value', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.onHoursPerDayInput('3');
    expect(comp.hoursPerDayError()).toBe('settings_hours_per_day_invalid');
  });

  it('onHoursPerDayInput clears error for valid value', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.onHoursPerDayInput('8');
    expect(comp.hoursPerDayError()).toBe('');
  });

  it('onHoursPerDayCommit saves without dialog when no conflict', async () => {
    apiMock.getDaysExceeding.mockReturnValue(of({ count: 0 }));
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    await comp.onHoursPerDayCommit('8');

    expect(apiMock.getDaysExceeding).toHaveBeenCalledWith(480);
    expect(matDialogMock.open).not.toHaveBeenCalled();
    expect(appSettingsMock.set).toHaveBeenCalledWith('minutesPerDay', '480');
    expect(comp.hoursPerDay()).toBe(8);
  });

  it('onHoursPerDayCommit opens confirm dialog when conflict exists', async () => {
    apiMock.getDaysExceeding.mockReturnValue(of({ count: 3 }));
    matDialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    await comp.onHoursPerDayCommit('4');

    expect(matDialogMock.open).toHaveBeenCalled();
    expect(appSettingsMock.set).toHaveBeenCalledWith('minutesPerDay', '240');
  });

  it('onHoursPerDayCommit reverts when user cancels conflict dialog', async () => {
    appSettingsMock.minutesPerDay.set(420);
    apiMock.getDaysExceeding.mockReturnValue(of({ count: 2 }));
    matDialogMock.open.mockReturnValue({ afterClosed: () => of(false) });
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    await comp.onHoursPerDayCommit('4');

    expect(appSettingsMock.set).not.toHaveBeenCalled();
    expect(comp.hoursPerDay()).toBe(7);
  });

  it('onHoursPerDayCommit is no-op when value unchanged', async () => {
    appSettingsMock.minutesPerDay.set(420);
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    await comp.onHoursPerDayCommit('7');

    expect(apiMock.getDaysExceeding).not.toHaveBeenCalled();
    expect(appSettingsMock.set).not.toHaveBeenCalled();
  });

  it('onHoursPerDayCommit reverts on invalid input', async () => {
    appSettingsMock.minutesPerDay.set(420);
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    await comp.onHoursPerDayCommit('25');

    expect(apiMock.getDaysExceeding).not.toHaveBeenCalled();
    expect(comp.hoursPerDay()).toBe(7);
  });
});

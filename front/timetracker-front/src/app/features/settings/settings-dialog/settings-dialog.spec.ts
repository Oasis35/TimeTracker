import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { SettingsDialogComponent } from './settings-dialog';

describe('SettingsDialogComponent', () => {
  const dialogRefMock = { close: vi.fn() };
  const apiMock = { exportBackup: vi.fn(), restoreBackup: vi.fn() };

  beforeEach(async () => {
    vi.restoreAllMocks();
    await TestBed.configureTestingModule({
      imports: [SettingsDialogComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: TrackerApi, useValue: apiMock },
      ],
    }).compileComponents();
  });

  it('renders the maintenance section', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el).toBeTruthy();
  });
});

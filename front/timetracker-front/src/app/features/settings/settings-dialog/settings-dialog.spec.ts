import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { SettingsDialogComponent } from './settings-dialog';

describe('SettingsDialogComponent', () => {
  const dialogRefMock = { close: vi.fn() };
  const apiMock = { exportBackup: vi.fn(), restoreBackup: vi.fn() };

  beforeEach(async () => {
    vi.restoreAllMocks();
    apiMock.exportBackup.mockReset();
    apiMock.restoreBackup.mockReset();

    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [
        SettingsDialogComponent,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: TrackerApi, useValue: apiMock },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      settings_title: 'Settings',
      settings_language: 'Language',
      settings_date_time: 'Date / time',
      settings_maintenance: 'Maintenance',
      backup_export: 'Export backup',
      backup_export_hint: 'Download a full copy of the SQLite database.',
      backup_export_success: 'Backup exported.',
      backup_restore: 'Restore backup',
      backup_restore_hint: 'Restore a .db file. A safety backup will be created automatically first.',
      backup_restore_select: 'Choose a .db file',
      backup_restore_selected: 'Selected file: {{file}}',
      backup_restore_confirm: 'Confirm restore?',
      backup_restore_success: 'Backup restored. Safety backup created: {{file}}',
      backup_file_missing: 'Please choose a backup file.',
      cancel: 'Cancel',
    });
    translate.use('en');
  });

  // ——————————————————————————————————————
  // BASE TESTS
  // ——————————————————————————————————————
  it('renders the maintenance section', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Maintenance');
    expect(html.textContent).toContain('Export backup');
    expect(html.textContent).toContain('Restore backup');
  });
});

// ———————————————————————————————————————————————
// MAINTENANCE TESTS (export/restore)
// ———————————————————————————————————————————————
describe('Maintenance features', () => {
  const dialogRefMock = { close: vi.fn() };
  const apiMock = { exportBackup: vi.fn(), restoreBackup: vi.fn() };

  function createComponent() {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    apiMock.exportBackup.mockReset();
    apiMock.restoreBackup.mockReset();

    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [
        SettingsDialogComponent,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: TrackerApi, useValue: apiMock },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      backup_file_missing: 'Please choose a backup file.',
      backup_export_success: 'Backup exported.',
      backup_restore_success: 'Backup restored',
      backup_restore_confirm: 'Confirm restore?',
    });
    translate.use('en');
  });

  it('calls the export endpoint', async () => {
    apiMock.exportBackup.mockReturnValue(
      of(
        new HttpResponse({
          body: new Blob(['backup']),
          headers: new HttpHeaders({
            'content-disposition': 'attachment; filename="backup.db"',
          }),
        }),
      ),
    );

    const fixture = createComponent();
    await fixture.componentInstance.exportBackup();

    expect(apiMock.exportBackup).toHaveBeenCalledTimes(1);
  });

  it('shows an error when restoring without a file', async () => {
    const fixture = createComponent();

    await fixture.componentInstance.restoreBackup();

    expect(fixture.componentInstance.maintenanceError()).toBe('Please choose a backup file.');
  });

  it('restores the selected file after confirmation', async () => {
    const file = new File(['backup'], 'restore.db');
    apiMock.restoreBackup.mockReturnValue(of({ safetyBackupFileName: 'pre-restore.db' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = createComponent();
    fixture.componentInstance.onBackupFileSelected({ target: { files: [file] } } as any);

    await fixture.componentInstance.restoreBackup();

    expect(apiMock.restoreBackup).toHaveBeenCalledWith(file);
    expect(fixture.componentInstance.selectedBackupFileName()).toBe('');
  });
});

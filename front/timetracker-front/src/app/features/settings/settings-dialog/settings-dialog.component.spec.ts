import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { SettingsDialogComponent } from './settings-dialog.component';

describe('SettingsDialogComponent', () => {
  const dialogRefMock = {
    close: vi.fn(),
  };

  const apiMock = {
    exportBackup: vi.fn(),
    restoreBackup: vi.fn(),
  };

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

  it('renders the maintenance section', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Maintenance');
    expect(compiled.textContent).toContain('Export backup');
    expect(compiled.textContent).toContain('Restore backup');
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

    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();

    await fixture.componentInstance.exportBackup();

    expect(apiMock.exportBackup).toHaveBeenCalledTimes(1);
  });

  it('shows an error when restoring without a file', async () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();

    await fixture.componentInstance.restoreBackup();

    expect(fixture.componentInstance.maintenanceError()).toBe('Please choose a backup file.');
  });

  it('restores the selected file after confirmation', async () => {
    const file = new File(['backup'], 'restore.db', { type: 'application/octet-stream' });
    apiMock.restoreBackup.mockReturnValue(of({ safetyBackupFileName: 'pre-restore-2026-03-10.db' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.onBackupFileSelected({ target: { files: [file] } } as unknown as Event);

    await fixture.componentInstance.restoreBackup();

    expect(apiMock.restoreBackup).toHaveBeenCalledWith(file);
    expect(fixture.componentInstance.selectedBackupFileName()).toBe('');
  });
});

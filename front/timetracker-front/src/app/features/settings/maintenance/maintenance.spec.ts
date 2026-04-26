import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TrackerApi } from '../../../core/api/tracker-api';
import { MaintenancePageComponent } from './maintenance';

describe('MaintenancePageComponent', () => {
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
        MaintenancePageComponent,
        MatDialogModule,
        MatSnackBarModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      backup_export_success: 'Backup exported.',
      backup_restore_success: 'Backup restored',
      backup_restore_confirm: 'Confirm restore?',
      backup_file_missing: 'Please choose a backup file.',
      cancel: 'Cancel',
      confirm: 'Confirm',
    });
    translate.use('en');
  });

  function create() {
    const fixture = TestBed.createComponent(MaintenancePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  // ——————————————————————————————————————
  // EXPORT TEST
  // ——————————————————————————————————————
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

    const fixture = create();

    await fixture.componentInstance.exportBackup();

    expect(apiMock.exportBackup).toHaveBeenCalledTimes(1);
  });

  // ——————————————————————————————————————
  // RESTORE TESTS
  // ——————————————————————————————————————
  it('shows an error when restoring without a file', async () => {
    const fixture = create();

    await fixture.componentInstance.restoreBackup();

    expect(fixture.componentInstance.maintenanceError()).toBe('Please choose a backup file.');
  });

  it('restores the selected file after confirmation', async () => {
    const file = new File(['backup'], 'restore.db');
    apiMock.restoreBackup.mockReturnValue(of({ safetyBackupFileName: 'pre-restore.db' }));

    const fixture = create();

    vi.spyOn((fixture.componentInstance as any).dialog, 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as any);

    fixture.componentInstance.onBackupFileSelected({ target: { files: [file] } } as any);
    await fixture.componentInstance.restoreBackup();

    expect(apiMock.restoreBackup).toHaveBeenCalledWith(file);
    expect(fixture.componentInstance.selectedBackupFileName()).toBe('');
  });
});

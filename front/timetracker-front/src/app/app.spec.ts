import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { AppSettingsService } from './core/services/app-settings.service';
import { UnitService } from './core/services/unit.service';
import { SettingsDialogComponent } from './features/settings/settings-dialog/settings-dialog';
import { of } from 'rxjs';

function makeAppSettingsMock(initial: Record<string, string> = {}) {
  const raw = signal(initial);
  return {
    language: () => {
      const v = raw()['language'];
      return v === 'en' ? 'en' : 'fr';
    },
    unitMode: () => {
      const v = raw()['unitMode'];
      return v === 'hour' ? 'hour' : 'day';
    },
    externalBaseUrl: () => raw()['externalBaseUrl'] ?? '',
    set: vi.fn((key: string, value: string) => {
      raw.update(s => ({ ...s, [key]: value }));
      return of(void 0);
    }),
    remove: vi.fn((key: string) => {
      raw.update(s => { const c = { ...s }; delete c[key]; return c; });
      return of(void 0);
    }),
  };
}

describe('App', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),
        { provide: AppSettingsService, useValue: makeAppSettingsMock() },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should expose UnitService default mode', () => {
    const fixture = TestBed.createComponent(App);
    const unit = TestBed.inject(UnitService);

    expect(fixture.componentInstance).toBeTruthy();
    expect(unit.unitMode()).toBe('day');
  });

  it('should expose navigation link for tickets grid', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const anchors = Array.from(compiled.querySelectorAll('a[href]'));
    const hrefs = anchors
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => href.length > 0);

    expect(hrefs.some((href) => href.endsWith('/tickets-grid'))).toBe(true);
  });

  it('loads language from AppSettingsService', async () => {
    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AppSettingsService, useValue: makeAppSettingsMock({ language: 'en' }) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    expect(app.currentLanguage()).toBe('en');
  });

  it('opens settings dialog with expected config', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const dialogOpen = vi.fn();
    (app as any).dialog = { open: dialogOpen };

    app.openSettingsDialog();

    expect(dialogOpen).toHaveBeenCalledWith(
      SettingsDialogComponent,
      expect.objectContaining({
        width: '460px',
        maxWidth: '95vw',
        autoFocus: false,
      }),
    );
  });
});

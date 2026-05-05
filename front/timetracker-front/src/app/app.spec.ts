import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { AppSettingsService } from './core/services/app-settings.service';
import { TrackerApi } from './core/api/tracker-api';
import { UnitService } from './core/services/unit.service';
import { IncompleteDaysService } from './core/services/incomplete-days.service';
import { SettingsDialogComponent } from './features/settings/settings-dialog/settings-dialog';
import { of } from 'rxjs';

const apiMock = {
  getIncompleteDays: vi.fn(() => of({ incompleteDays: [] })),
  getMetadata: vi.fn(() => of({ minutesPerDay: 480, allowedMinutesDayMode: [], allowedMinutesHourMode: [], defaultUnit: 'day', defaultType: 'DEV', tickets: [] })),
  getTicketTotals: vi.fn(() => of([])),
};

function makeIncompleteDaysMock(count: number, days: string[], isLoading = false) {
  return {
    incompleteDaysRes: { isLoading: signal(isLoading) },
    count: signal(count),
    days: signal(days),
    reload: vi.fn(),
  };
}

async function setupWithIncompleteDays(mock: ReturnType<typeof makeIncompleteDaysMock>) {
  await TestBed.configureTestingModule({
    imports: [App, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      { provide: AppSettingsService, useValue: makeAppSettingsMock() },
      { provide: TrackerApi, useValue: apiMock },
      { provide: IncompleteDaysService, useValue: mock },
    ],
  }).compileComponents();
  return TestBed.createComponent(App);
}

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
        { provide: TrackerApi, useValue: apiMock },
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
        { provide: TrackerApi, useValue: apiMock },
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

  describe('incompleteDaysTooltip', () => {
    it('returns ok translation key when there are no incomplete days', async () => {
      const fixture = await setupWithIncompleteDays(makeIncompleteDaysMock(0, []));
      expect(fixture.componentInstance.incompleteDaysTooltip()).toBe('incomplete_days_tooltip_ok');
    });

    it('returns warning translation key when there are incomplete days', async () => {
      const fixture = await setupWithIncompleteDays(
        makeIncompleteDaysMock(2, ['2026-04-28', '2026-04-29']),
      );
      const tooltip = fixture.componentInstance.incompleteDaysTooltip();
      expect(tooltip).toContain('incomplete_days_tooltip_warning');
    });

    it('hides the indicator button while loading', async () => {
      const loadingMock = {
        incompleteDaysRes: { isLoading: signal(true) },
        count: signal(0),
        days: signal([]),
        reload: vi.fn(),
      };
      const fixture = await setupWithIncompleteDays(loadingMock);
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.incomplete-days-btn');
      expect(btn).toBeNull();
    });

    it('shows ok button with check_circle when count is 0', async () => {
      const fixture = await setupWithIncompleteDays(makeIncompleteDaysMock(0, []));
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.incomplete-days-btn-ok');
      expect(btn).not.toBeNull();
      expect(btn.querySelector('mat-icon')?.textContent).toContain('check_circle');
    });

    it('shows warning button with count badge when count > 0', async () => {
      const fixture = await setupWithIncompleteDays(
        makeIncompleteDaysMock(3, ['2026-04-28', '2026-04-29', '2026-04-30']),
      );
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.incomplete-days-btn-warn');
      expect(btn).not.toBeNull();
      expect(btn.querySelector('.incomplete-days-count')?.textContent?.trim()).toBe('3');
    });
  });
});

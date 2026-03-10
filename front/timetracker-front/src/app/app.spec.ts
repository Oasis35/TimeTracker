import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { UnitService } from './core/services/unit.service';
import { SettingsDialogComponent } from './features/settings/settings-dialog/settings-dialog.component';

describe('App', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.removeItem('tt.language');
    localStorage.removeItem('tt.unitMode');
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslateModule.forRoot(),
      ],
      providers: [provideRouter([])],
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

  it('loads language from local storage', async () => {
    localStorage.setItem('tt.language', 'en');
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

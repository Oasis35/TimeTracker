import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { UnitService } from './core/services/unit.service';

describe('App', () => {
  beforeEach(async () => {
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

  it('should propagate unit mode changes through UnitService', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const unit = TestBed.inject(UnitService);

    app.onTimeChange('hour');

    expect(unit.unitMode()).toBe('hour');
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
});

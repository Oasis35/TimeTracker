import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { UnitService } from './core/services/unit.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
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

  it('should render navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('.app-nav a');
    expect(links.length).toBe(3);
  });

  it('should propagate unit mode changes through UnitService', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const unit = TestBed.inject(UnitService);

    app.onTimeChange('hour');

    expect(unit.unitMode()).toBe('hour');
  });
});

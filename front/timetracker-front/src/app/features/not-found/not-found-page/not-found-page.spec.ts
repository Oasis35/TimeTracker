import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NotFoundPageComponent } from './not-found-page';

describe('NotFoundPageComponent', () => {
  it('should create', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundPageComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.status-code')?.textContent?.trim()).toBe('404');
  });
});

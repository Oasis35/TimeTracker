import { Injectable, Signal, computed, signal } from '@angular/core';
import { TRANSLATIONS, TranslationKey } from '../i18n/translations';
export type { TranslationKey } from '../i18n/translations';

export type AppLanguage = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly languageSignal = signal<AppLanguage>('fr');

  readonly language: Signal<AppLanguage> = this.languageSignal.asReadonly();
  readonly dateLocale = computed(() => (this.language() === 'fr' ? 'fr-FR' : 'en-US'));

  setLanguage(language: AppLanguage): void {
    this.languageSignal.set(language);
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let value = String(TRANSLATIONS[this.language()][key]);
    if (!params) return value;

    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{{${paramKey}}}`, String(paramValue));
    }

    return value;
  }

  tr(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.t(key, params);
  }
}

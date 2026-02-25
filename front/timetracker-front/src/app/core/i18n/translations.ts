import { translationEn } from './translation.en';
import { translationFr } from './translation.fr';

export const TRANSLATIONS = {
  fr: translationFr,
  en: translationEn,
} as const;

export type TranslationKey = keyof typeof translationFr;

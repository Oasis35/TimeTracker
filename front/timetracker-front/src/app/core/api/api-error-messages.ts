import { HttpErrorResponse } from '@angular/common/http';
import { TranslationKey } from '../i18n/translations';

const API_ERROR_TRANSLATION_BY_CODE: Record<string, TranslationKey> = {
  TT_UNKNOWN_ERROR: 'unknown_error_contact_admin',
  TT_MONTH_INVALID: 'month_invalid',
  TT_CONFIG_MINUTES_PER_DAY_INVALID: 'config_minutes_per_day_invalid',
  TT_TICKET_ID_INVALID: 'ticket_id_invalid',
  TT_TICKET_TYPE_REQUIRED: 'type_required',
  TT_TICKET_LABEL_REQUIRED: 'label_required_with_external',
  TT_BACKUP_FILE_MISSING: 'backup_file_missing',
  TT_BACKUP_FILE_INVALID: 'backup_file_invalid',
  TT_TICKET_NOT_FOUND: 'ticket_not_found',
  TT_TICKET_HAS_TIME_ENTRIES: 'ticket_has_time_entries',
  TT_TICKET_NO_TIME_ENTRIES: 'ticket_no_time_entries',
  TT_TICKET_COMPLETED_LOCKED: 'ticket_completed_locked',
  TT_TICKET_ALREADY_EXISTS: 'ticket_already_exists',
  TT_FILTER_YEAR_MONTH_REQUIRED: 'filter_year_month_required',
  TT_MINUTES_OUT_OF_RANGE: 'minutes_out_of_range',
  TT_STEP_15: 'minutes_step_15',
  TT_OVERFLOW_DAY: 'overflow_day',
};

export function resolveApiErrorTranslationKey(
  error: unknown,
  fallback: TranslationKey,
): TranslationKey {
  const code = extractApiErrorCode(error);
  if (!code) return fallback;
  return API_ERROR_TRANSLATION_BY_CODE[code] ?? fallback;
}

function extractApiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const payload = error.error;
  if (!payload || typeof payload !== 'object') return null;

  const code = (payload as Record<string, unknown>)['code'];
  return typeof code === 'string' && code ? code : null;
}

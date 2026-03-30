import { HttpErrorResponse } from '@angular/common/http';
import { resolveApiErrorTranslationKey } from './api-error-messages';

describe('resolveApiErrorTranslationKey', () => {
  // ——————————————————————————————————————
  // Known error code mappings
  // ——————————————————————————————————————
  const mappings: Array<[string, string]> = [
    ['TT_UNKNOWN_ERROR', 'unknown_error_contact_admin'],
    ['TT_MONTH_INVALID', 'month_invalid'],
    ['TT_CONFIG_MINUTES_PER_DAY_INVALID', 'config_minutes_per_day_invalid'],
    ['TT_TICKET_ID_INVALID', 'ticket_id_invalid'],
    ['TT_TICKET_TYPE_REQUIRED', 'type_required'],
    ['TT_TICKET_LABEL_REQUIRED', 'label_required_with_external'],
    ['TT_BACKUP_FILE_MISSING', 'backup_file_missing'],
    ['TT_BACKUP_FILE_INVALID', 'backup_file_invalid'],
    ['TT_TICKET_NOT_FOUND', 'ticket_not_found'],
    ['TT_TICKET_HAS_TIME_ENTRIES', 'ticket_has_time_entries'],
    ['TT_TICKET_NO_TIME_ENTRIES', 'ticket_no_time_entries'],
    ['TT_TICKET_COMPLETED_LOCKED', 'ticket_completed_locked'],
    ['TT_TICKET_ALREADY_EXISTS', 'ticket_already_exists'],
    ['TT_FILTER_YEAR_MONTH_REQUIRED', 'filter_year_month_required'],
    ['TT_MINUTES_OUT_OF_RANGE', 'minutes_out_of_range'],
    ['TT_STEP_15', 'minutes_step_15'],
    ['TT_OVERFLOW_DAY', 'overflow_day'],
  ];

  it.each(mappings)('maps %s to %s', (code, expectedKey) => {
    const error = new HttpErrorResponse({ status: 400, error: { code } });
    expect(resolveApiErrorTranslationKey(error, 'cannot_update_ticket')).toBe(expectedKey);
  });

  // ——————————————————————————————————————
  // Fallback cases
  // ——————————————————————————————————————
  it('returns fallback when api code is unknown', () => {
    const error = new HttpErrorResponse({ status: 400, error: { code: 'TT_NOT_MAPPED' } });
    expect(resolveApiErrorTranslationKey(error, 'cannot_update_ticket')).toBe('cannot_update_ticket');
  });

  it('returns fallback when error is not an HttpErrorResponse', () => {
    expect(resolveApiErrorTranslationKey(new Error('network'), 'cannot_log_time')).toBe('cannot_log_time');
  });

  it('returns fallback when error is null', () => {
    expect(resolveApiErrorTranslationKey(null, 'cannot_log_time')).toBe('cannot_log_time');
  });

  it('returns fallback when error payload has no code property', () => {
    const error = new HttpErrorResponse({ status: 500, error: { message: 'Internal error' } });
    expect(resolveApiErrorTranslationKey(error, 'unknown_error_contact_admin')).toBe('unknown_error_contact_admin');
  });

  it('returns fallback when error payload is a plain string', () => {
    const error = new HttpErrorResponse({ status: 400, error: 'Bad request' });
    expect(resolveApiErrorTranslationKey(error, 'cannot_create_ticket')).toBe('cannot_create_ticket');
  });
});

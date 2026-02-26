import { HttpErrorResponse } from '@angular/common/http';
import { resolveApiErrorTranslationKey } from './api-error-messages';

describe('resolveApiErrorTranslationKey', () => {
  it('maps TT_TICKET_NO_TIME_ENTRIES to ticket_no_time_entries', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'TT_TICKET_NO_TIME_ENTRIES' },
    });

    const key = resolveApiErrorTranslationKey(error, 'cannot_update_ticket');

    expect(key).toBe('ticket_no_time_entries');
  });

  it('returns fallback when api code is unknown', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'TT_NOT_MAPPED' },
    });

    const key = resolveApiErrorTranslationKey(error, 'cannot_update_ticket');

    expect(key).toBe('cannot_update_ticket');
  });
});
